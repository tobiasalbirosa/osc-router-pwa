import { TAB_CONFIG } from "../../navigation/routes";
import { colors, space } from "../../theme/tokens";

/**
 * Equivalente a <BottomTab.Navigator> en React Native.
 * En RN: reemplaza por createBottomTabNavigator con los mismos `route` keys.
 */
export function BottomTabBar({ activeRoute, onSelect }) {
  return (
    <nav
      role="tablist"
      aria-label="Navegación principal"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        borderTop: `1px solid ${colors.border}`,
        backgroundColor: colors.navBg,
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        zIndex: 100,
      }}
    >
      {TAB_CONFIG.map((tab) => {
        const active = activeRoute === tab.route;
        return (
          <button
            key={tab.route}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={tab.accessibilityLabel}
            onClick={() => onSelect(tab.route)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: space.xs,
              padding: `${space.md}px ${space.sm}px`,
              border: "none",
              background: "transparent",
              color: active ? colors.navActive : colors.navInactive,
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "system-ui, Segoe UI, Roboto, sans-serif",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
