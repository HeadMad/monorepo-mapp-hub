package com.mapphub.shell;

import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MappSystemPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setWebViewClient(new MappWebViewClient(
                getBridge(),
                MappDatabaseHelper.getInstance(this),
                MappPackageManager.getInstance(this),
                MappLocalAssetHandler.getInstance(this)));
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        // Отступы вешаем на корень содержимого Activity (android.R.id.content):
        // он получает insets раньше любого дочернего View, поэтому WebView,
        // его родители и любые оверлеи оболочки гарантированно уходят внутрь
        // безопасной зоны (статус-бар, навигация, вырез).
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (view, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(content);
    }
}
