import { colors, space, typography } from "../../theme/tokens";

export function ScreenContainer({ title, subtitle, children }) {
  return (
    <div
      style={{
        padding: space.lg,
        paddingBottom: 88,
        maxWidth: 544,
        margin: "0 auto",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {title ? (
        <h1
          style={{
            margin: `0 0 ${space.sm}px`,
            color: colors.text,
            fontSize: typography.title.fontSize,
            fontWeight: typography.title.fontWeight,
          }}
        >
          {title}
        </h1>
      ) : null}
      {subtitle ? (
        <p
          style={{
            margin: `0 0 ${space.lg}px`,
            color: colors.muted,
            fontSize: typography.subtitle.fontSize,
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </p>
      ) : null}
      {children}
    </div>
  );
}
