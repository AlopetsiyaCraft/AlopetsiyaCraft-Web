package com.alopetsiya.shop;

/**
 * Настройки интеграции. В реальном моде замени на NeoForge ModConfigSpec,
 * но для примера достаточно переменных окружения.
 */
public record ShopConfig(String websiteUrl, String apiKey, int pollSeconds) {
    public static ShopConfig fromEnvironment() {
        String url = env("ALOPETSIYA_SHOP_URL", "http://127.0.0.1:3000");
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        String key = env("CHAT_API_KEY", "");
        int poll = 30;
        try {
            poll = Math.max(5, Integer.parseInt(env("ALOPETSIYA_SHOP_POLL_SECONDS", "30")));
        } catch (NumberFormatException ignored) {
            // оставляем 30 секунд
        }
        return new ShopConfig(url, key, poll);
    }

    public boolean enabled() {
        return !websiteUrl.isBlank() && !apiKey.isBlank();
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
