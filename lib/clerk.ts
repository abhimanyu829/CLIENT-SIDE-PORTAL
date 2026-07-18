export const clerkAppearance: any = {
  variables: {
    colorPrimary: "#7c3aed",
    colorBackground: "#0a0a0a",
    colorText: "#f8fafc",
    colorTextSecondary: "#a1a1aa",
    colorInputBackground: "rgba(255,255,255,0.04)",
    colorInputText: "#f8fafc",
    colorNeutral: "#27272a",
    colorDanger: "#ef4444",
    borderRadius: "0.875rem",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
}

export const clerkAuralisAppearance: any = {
  variables: {
    colorPrimary: "#EA580C", // Auralis Primary
    colorBackground: "transparent",
    colorText: "#111827", // Auralis text-primary
    colorTextSecondary: "#4B5563", // Auralis text-secondary
    colorInputBackground: "rgba(255,255,255,0.8)",
    colorInputText: "#111827",
    colorNeutral: "#E5E7EB", // Auralis border
    colorDanger: "#dc2626",
    borderRadius: "0.5rem",
    fontFamily: '"Geist", "Inter", sans-serif',
  },
  elements: {
    card: "bg-transparent shadow-none w-full border-none",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton: "border-border hover:bg-slate-50 transition-colors",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-white font-medium shadow-none transition-colors",
    formFieldInput: "bg-white border-border text-foreground shadow-sm focus:ring-primary focus:border-primary",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
  }
}

