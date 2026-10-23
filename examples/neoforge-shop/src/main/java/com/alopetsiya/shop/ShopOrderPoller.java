package com.alopetsiya.shop;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Опрашивает сайт раз в N секунд и раздаёт заказы.
 *
 * Вызывать из ServerTickEvent.Post:
 *   ShopOrderPoller.tick(event.getServer());
 */
public final class ShopOrderPoller {
    private static final Logger LOGGER = LoggerFactory.getLogger("AlopetsiyaShop");
    private static final Gson GSON = new Gson();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private static final AtomicInteger TICKS = new AtomicInteger();
    private static final Set<Long> IN_FLIGHT = ConcurrentHashMap.newKeySet();

    private static ShopConfig config;
    private static boolean warnedDisabled;

    private ShopOrderPoller() {
    }

    public static void tick(MinecraftServer server) {
        if (config == null) {
            config = ShopConfig.fromEnvironment();
            if (!config.enabled()) {
                if (!warnedDisabled) {
                    warnedDisabled = true;
                    LOGGER.warn("AlopetsiyaShop: CHAT_API_KEY не задан — магазин не опрашивается");
                }
                return;
            }
            LOGGER.info("AlopetsiyaShop: опрос {} каждые {} с", config.websiteUrl(), config.pollSeconds());
        }

        if (TICKS.incrementAndGet() < config.pollSeconds() * 20) {
            return;
        }
        TICKS.set(0);
        poll(server);
    }

    private static void poll(MinecraftServer server) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.websiteUrl() + "/api/shop/orders/pending"))
                .timeout(Duration.ofSeconds(10))
                .header("x-api-key", config.apiKey())
                .GET()
                .build();

        HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(response -> {
                    if (response.statusCode() != 200) {
                        LOGGER.warn("AlopetsiyaShop: pending вернул HTTP {}", response.statusCode());
                        return;
                    }
                    PendingResponse pending;
                    try {
                        pending = GSON.fromJson(response.body(), PendingResponse.class);
                    } catch (Exception e) {
                        LOGGER.warn("AlopetsiyaShop: не разобрал ответ", e);
                        return;
                    }
                    if (pending == null || pending.orders() == null) {
                        return;
                    }
                    for (Order order : pending.orders()) {
                        if (order == null || !IN_FLIGHT.add(order.id())) {
                            continue;
                        }
                        // Плащ и пластинку нельзя выдать автоматически: оставляем админу.
                        if ("cape".equals(order.kind()) || "disc".equals(order.kind())) {
                            IN_FLIGHT.remove(order.id());
                            LOGGER.debug("AlopetsiyaShop: заказ {} ({}) ждёт ручной выдачи", order.id(), order.kind());
                            continue;
                        }
                        server.execute(() -> deliver(server, order));
                    }
                })
                .exceptionally(error -> {
                    LOGGER.warn("AlopetsiyaShop: не удалось опросить сайт", error);
                    return null;
                });
    }

    private static void deliver(MinecraftServer server, Order order) {
        try {
            if (!server.isRunning()) {
                return;
            }
            ServerPlayer player = findPlayer(server, order.nickname());
            if (player == null) {
                // Игрок офлайн — заказ останется pending до следующего захода.
                LOGGER.info("AlopetsiyaShop: {} офлайн, заказ {} ждёт", order.nickname(), order.id());
                return;
            }

            ShopOrderHandler.Result result = ShopOrderHandler.deliver(server, player, order);
            postResult(order, result);
            if (result.ok()) {
                LOGGER.info("AlopetsiyaShop: выдан заказ {} ({}) игроку {}",
                        order.id(), order.kind(), order.nickname());
            } else {
                LOGGER.warn("AlopetsiyaShop: заказ {} не выдан: {}", order.id(), result.error());
            }
        } catch (Exception e) {
            LOGGER.error("AlopetsiyaShop: ошибка выдачи заказа {}", order.id(), e);
            postResult(order, new ShopOrderHandler.Result(false, "mod exception: " + e.getMessage()));
        } finally {
            IN_FLIGHT.remove(order.id());
        }
    }

    private static ServerPlayer findPlayer(MinecraftServer server, String nickname) {
        ServerPlayer exact = server.getPlayerList().getPlayerByName(nickname);
        if (exact != null) {
            return exact;
        }
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            if (player.getGameProfile().getName().equalsIgnoreCase(nickname)) {
                return player;
            }
        }
        return null;
    }

    private static void postResult(Order order, ShopOrderHandler.Result result) {
        JsonObject body = new JsonObject();
        body.addProperty("orderId", order.id());
        body.addProperty("ok", result.ok());
        if (!result.ok()) {
            body.addProperty("error", result.error() == null ? "delivery failed" : result.error());
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(config.websiteUrl() + "/api/shop/orders/result"))
                .timeout(Duration.ofSeconds(10))
                .header("x-api-key", config.apiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body)))
                .build();

        HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenAccept(response -> {
                    if (response.statusCode() != 200) {
                        LOGGER.warn("AlopetsiyaShop: result {} вернул HTTP {}: {}",
                                order.id(), response.statusCode(), response.body());
                    }
                })
                .exceptionally(error -> {
                    LOGGER.warn("AlopetsiyaShop: не отправил результат заказа {}", order.id(), error);
                    return null;
                });
    }

    public record Order(long id, String nickname, String title, String kind, JsonObject payload, long createdAt) {
    }

    private record PendingResponse(List<Order> orders) {
    }
}
