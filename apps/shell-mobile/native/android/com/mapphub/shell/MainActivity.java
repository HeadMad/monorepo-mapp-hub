package com.mapphub.shell;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MappSystemPlugin.class);
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setWebViewClient(new MappWebViewClient(
                getBridge(),
                this,
                MappDatabaseHelper.getInstance(this),
                MappPackageManager.getInstance(this)));
    }
}
