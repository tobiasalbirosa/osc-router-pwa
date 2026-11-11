import { useMemo, useRef, useEffect, useState } from "react";
import { TabRoute } from "./navigation/routes";
import { BottomTabBar } from "./components/navigation/BottomTabBar";
import { SensorsScreen } from "./screens/SensorsScreen";
import { DestinoScreen } from "./screens/DestinoScreen";
import { OscBridge, loadOscTarget } from "./lib/oscBridge";
import { colors } from "./theme/tokens";

export default function App() {
  const [tab, setTab] = useState(TabRoute.Sensors);
  const [target, setTarget] = useState(() => loadOscTarget());
  const targetRef = useRef(target);
  targetRef.current = target;

  const bridge = useMemo(
    () =>
      new OscBridge(() => ({
        host: targetRef.current.host,
        port: targetRef.current.port,
      })),
    []
  );

  useEffect(() => {
    bridge.connect(() => {});
  }, [bridge]);

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.background = colors.bg;
    document.body.style.color = colors.text;
    document.body.style.fontFamily = 'system-ui, "Segoe UI", Roboto, sans-serif';
    document.body.style.lineHeight = "1.45";
  }, []);

  return (
    <>
      <div style={{ minHeight: "100vh" }}>
        {tab === TabRoute.Sensors ? <SensorsScreen bridge={bridge} /> : null}
        {tab === TabRoute.Destiny ? (
          <DestinoScreen target={target} setTarget={setTarget} bridge={bridge} />
        ) : null}
      </div>
      <BottomTabBar activeRoute={tab} onSelect={setTab} />
    </>
  );
}
