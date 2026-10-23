package com.alopetsiya.shop;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.ChatFormatting;
import net.minecraft.core.Holder;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.TamableAnimal;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.ItemEnchantments;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Выдача заказов по kind. Версия-зависимые места (компоненты предметов,
 * приручение) помечены — поправь под свою версию NeoForge/Minecraft.
 */
public final class ShopOrderHandler {
    public record Result(boolean ok, String error) {
        public static Result ok() {
            return new Result(true, null);
        }

        public static Result fail(String message) {
            return new Result(false, message);
        }
    }

    /** Титулы, выданные игрокам. Подключи к своему чат-форматтеру. */
    private static final Map<UUID, String> TITLES = new ConcurrentHashMap<>();
    /** Эффекты ника: например, "gradient:#5d9c3c:#f2c94c". */
    private static final Map<UUID, String> NICK_EFFECTS = new ConcurrentHashMap<>();

    private ShopOrderHandler() {
    }

    public static Result deliver(MinecraftServer server, ServerPlayer player, ShopOrderPoller.Order order) {
        try {
            JsonObject payload = order.payload() == null ? new JsonObject() : order.payload();
            return switch (order.kind()) {
                case "item" -> giveItem(player, payload);
                case "pet" -> spawnPet(player, payload);
                case "title" -> applyTitle(player, payload);
                case "nick_effect" -> applyNickEffect(player, payload);
                default -> Result.fail("unknown kind: " + order.kind());
            };
        } catch (Exception e) {
            return Result.fail(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
    }

    private static Result giveItem(ServerPlayer player, JsonObject payload) {
        ResourceLocation id = ResourceLocation.tryParse(str(payload, "material", ""));
        if (id == null) {
            return Result.fail("bad material");
        }
        Item item = BuiltInRegistries.ITEM.getOptional(id).orElse(null);
        if (item == null) {
            return Result.fail("unknown item: " + id);
        }

        ItemStack stack = new ItemStack(item, clamp(intValue(payload, "count", 1), 1, 64));
        String name = str(payload, "name", "");
        if (!name.isBlank()) {
            stack.set(DataComponents.CUSTOM_NAME,
                    Component.literal(name).withStyle(ChatFormatting.GOLD));
        }

        if (payload.has("lore") && payload.get("lore").isJsonArray()) {
            List<Component> lore = new ArrayList<>();
            JsonArray lines = payload.getAsJsonArray("lore");
            for (JsonElement line : lines) {
                lore.add(Component.literal(line.getAsString()).withStyle(ChatFormatting.GRAY));
            }
            if (!lore.isEmpty()) {
                stack.set(DataComponents.LORE, new ItemLore(lore));
            }
        }

        // 1.21.1: ItemEnchantments.Mutable + Holder<Enchantment>.
        if (payload.has("enchants") && payload.get("enchants").isJsonObject()) {
            ItemEnchantments.Mutable enchants = new ItemEnchantments.Mutable(ItemEnchantments.EMPTY);
            for (var entry : payload.getAsJsonObject("enchants").entrySet()) {
                ResourceLocation enchantId = ResourceLocation.tryParse(entry.getKey());
                if (enchantId == null) {
                    continue;
                }
                ResourceKey<Enchantment> key = ResourceKey.create(Registries.ENCHANTMENT, enchantId);
                Holder.Reference<Enchantment> holder =
                        BuiltInRegistries.ENCHANTMENT.getHolder(key).orElse(null);
                if (holder != null) {
                    enchants.set(holder, clamp(entry.getValue().getAsInt(), 1, 5));
                }
            }
            stack.set(DataComponents.ENCHANTMENTS, enchants.toImmutable());
        }

        if (!player.getInventory().add(stack)) {
            player.drop(stack, false);
        }
        player.sendSystemMessage(Component.literal("Получено: ").append(Component.literal(name.isBlank() ? item.getDescription().getString() : name)).withStyle(ChatFormatting.GREEN));
        return Result.ok();
    }

    private static Result spawnPet(ServerPlayer player, JsonObject payload) {
        ResourceLocation id = ResourceLocation.tryParse(str(payload, "mob", "minecraft:wolf"));
        if (id == null) {
            return Result.fail("bad mob");
        }
        EntityType<?> type = BuiltInRegistries.ENTITY_TYPE.getOptional(id).orElse(null);
        if (type == null) {
            return Result.fail("unknown mob: " + id);
        }
        Entity entity = type.create(player.serverLevel());
        if (entity == null) {
            return Result.fail("cannot create mob: " + id);
        }

        String name = str(payload, "name", "Питомец");
        entity.setCustomName(Component.literal(name));
        entity.setCustomNameVisible(true);
        entity.moveTo(player.getX(), player.getY(), player.getZ(), player.getYRot(), 0);

        if (entity instanceof TamableAnimal tameable) {
            // В некоторых версиях 1.21 сигнатура setTame(boolean, boolean).
            tameable.setTame(true);
            tameable.setOwnerUUID(player.getUUID());
        }

        player.serverLevel().addFreshEntity(entity);
        player.sendSystemMessage(Component.literal("Питомец " + name + " приручён!").withStyle(ChatFormatting.GREEN));
        return Result.ok();
    }

    private static Result applyTitle(ServerPlayer player, JsonObject payload) {
        String title = str(payload, "title", "Легенда");
        TITLES.put(player.getUUID(), title);
        player.sendSystemMessage(Component.literal("Титул выдан: " + title).withStyle(ChatFormatting.GOLD));
        return Result.ok();
    }

    private static Result applyNickEffect(ServerPlayer player, JsonObject payload) {
        String style = str(payload, "style", "gradient");
        String colors = payload.has("colors") ? payload.get("colors").toString() : "";
        NICK_EFFECTS.put(player.getUUID(), style + ":" + colors);
        player.sendSystemMessage(Component.literal("Ник-эффект активирован!").withStyle(ChatFormatting.LIGHT_PURPLE));
        return Result.ok();
    }

    /** Для чат-форматтера: титул игрока или пустая строка. */
    public static String title(UUID player) {
        return TITLES.getOrDefault(player, "");
    }

    /** Для чат-форматтера: эффект ника игрока или пустая строка. */
    public static String nickEffect(UUID player) {
        return NICK_EFFECTS.getOrDefault(player, "");
    }

    private static String str(JsonObject object, String key, String fallback) {
        if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
            return fallback;
        }
        try {
            return object.get(key).getAsString();
        } catch (Exception e) {
            return fallback;
        }
    }

    private static int intValue(JsonObject object, String key, int fallback) {
        if (object == null || !object.has(key) || object.get(key).isJsonNull()) {
            return fallback;
        }
        try {
            return object.get(key).getAsInt();
        } catch (Exception e) {
            return fallback;
        }
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
