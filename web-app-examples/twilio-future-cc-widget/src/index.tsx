import merge from "lodash.merge";
import { render } from "react-dom";
import { Provider } from "react-redux";

import { store } from "./store/store";
import { WebchatWidget } from "./components/WebchatWidget";
import { sessionDataHandler } from "./sessionDataHandler";
import { initConfig } from "./store/actions/initActions";
import { ConfigState } from "./store/definitions";
import { initLogger } from "./logger";
import { AnalyticsProvider } from "./components/Analytics";

const getDomain = () => {
    if (window.location.hostname !== "localhost") {
        return `https://${process.env.REACT_APP_SERVER_URL}`;
    }
    return process.env.REACT_APP_LOCAL_SERVER_URL;
};

const defaultConfig: ConfigState = {
    serverUrl: getDomain(),
    theme: {
        isLight: true
    },
    fileAttachment: {
        enabled: true,
        maxFileSize: 16777216, // 16 MB
        acceptedExtensions: ["jpg", "jpeg", "png", "amr", "mp3", "mp4", "pdf", "txt"]
    },
    transcript: {
        downloadEnabled: false,
        emailEnabled: false,
        emailSubject: (agentNames) => {
            let subject = "Transcript of your chat";
            if (agentNames.length > 0) {
                subject = subject.concat(` with ${agentNames[0]}`);
                agentNames.slice(1).forEach((name) => (subject = subject.concat(` and ${name}`)));
            }
            return subject;
        },
        emailContent: (customerName, transcript) => {
            return `<div><h1 style="text-align:center;">Chat Transcript</h1><p>Hello ${customerName},<br><br>Please see below your transcript, with any associated files attached, as requested.<br><br>${transcript}</p></div>`;
        }
    }
};

const initWebchat = async (config: ConfigState) => {
    const mergedConfig = merge({}, defaultConfig, config);
    sessionDataHandler.setEndpoint(mergedConfig.serverUrl);
    store.dispatch(initConfig(mergedConfig));
    initLogger();
    const rootElement = document.getElementById("twilio-webchat-widget-root");

    render(
        <Provider store={store}>
            <AnalyticsProvider writeKey={process.env.REACT_APP_SEGMENT_WRITE_KEY || "not configured"}>
                <WebchatWidget />
            </AnalyticsProvider>
        </Provider>,
        rootElement
    );
};

declare global {
    interface Window {
        Twilio: {
            initWebchat: (config: ConfigState) => void;
        };
        store: typeof store;
    }
}

// Expose `initWebchat` function to window object
Object.assign(window, {
    Twilio: {
        initWebchat
    }
});
