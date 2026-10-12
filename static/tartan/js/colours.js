// Default shades, one per code on the Scottish Register of Tartans colour
// sheet (Colour_shades.pdf, 25 codes). The sheet lists many hex values for
// most codes. Each entry below is a single shade copied from that sheet,
// chosen as a recognisable mid tone, not an average and not the only shade
// the Register will accept. A name-only palette entry uses this hex.

/** @type {Record<string, string>} */
export const DEFAULT_SHADES = {
  // Light Red. Sheet also lists #F4CCCC and #F04DB0.
  LR: "E87878",
  // Red. One of the eight reds on the sheet.
  R: "C80000",
  // Dark Red. One of the dark reds on the sheet.
  DR: "880000",
  // Orange.
  O: "E86000",
  // Dark Orange. The only dark orange on the sheet.
  DO: "BE7832",
  // Light Yellow.
  LY: "F8E38C",
  // Yellow.
  Y: "FCCC00",
  // Dark Yellow.
  DY: "C89800",
  // Light Green.
  LG: "649848",
  // Green.
  G: "006400",
  // Dark Green.
  DG: "003C14",
  // Light Blue. Not the cyan #00FCFC, which is also listed.
  LB: "98C8E8",
  // Blue. The sheet's blues run from very pale to navy; this is a mid navy.
  B: "2C4084",
  // Dark Blue.
  DB: "141E46",
  // Light Purple.
  LP: "A8ACE8",
  // Purple.
  P: "780078",
  // Dark Purple.
  DP: "440044",
  // White.
  W: "FFFFFF",
  // Light Grey. The only light grey on the sheet. Code LN, N for neutral.
  LN: "E0E0E0",
  // Grey.
  N: "808080",
  // Dark Grey. The sheet writes this hex in lowercase.
  DN: "555A64",
  // Black. The sheet also lists #000000. #101010 is the first black on it.
  K: "101010",
  // Light Brown. T is brown, so it is not confused with blue.
  LT: "A07C58",
  // Brown.
  T: "98481C",
  // Dark Brown.
  DT: "4C3428",
};

export const UNKNOWN_HEX = "B9B2A9";
