const channel = (value: number) => {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
};

export const relativeLuminance = (hex: string) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) {
    throw new Error(`Expected a #RRGGBB colour, got ${hex}`);
  }

  const value = match[1];
  const [r, g, b] = [0, 2, 4].map(offset => channel(Number.parseInt(value.slice(offset, offset + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

export const contrastRatio = (foreground: string, background: string) => {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

export const readCssVariable = (css: string, name: string) => {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  if (!match?.[1]) {
    throw new Error(`CSS variable ${name} is not a #RRGGBB literal`);
  }

  return match[1].toUpperCase();
};
