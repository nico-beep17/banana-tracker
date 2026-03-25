package com.lavc.bananatracker;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Get the WebView from the Capacitor bridge and override its WebChromeClient
        // to automatically grant camera/microphone permissions requested by web content
        // (e.g. html5-qrcode's getUserMedia call for the QR scanner)
        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                // Auto-grant camera and microphone permissions to the WebView
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
    }
}
