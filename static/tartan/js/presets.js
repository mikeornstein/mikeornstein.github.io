// Threadcounts are the archived Scottish Tartans Authority "Tartan Ferret"
// counts from Koios's research, section 5, copied character for character
// and then written in Register notation.
//
// WW (Wilson's White), A (Azure) and OG (Olive Green) are not on the
// Register colour sheet. The hex in each preset is a shade chosen by us,
// unverified.

const SHADE_UNVERIFIED = "Shade chosen by us, unverified.";

/** @type {Array<Record<string, unknown>>} */
export const PRESETS = [
  {
    id: "royal-stewart",
    name: "Royal Stewart",
    available: true,
    story:
      "Listed in Wilsons of Bannockburn's records from around 1800, and worn by George IV in 1822.",
    sourceUrl:
      "https://web.archive.org/web/20101024215257/http://www.tartansauthority.com/tartan-ferret/display/1370/royal-stewart-universal&tartan_name=stewart&tartan_name_search=",
    sourceLabel: "Archived Scottish Tartans Authority record",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=3958",
    threadcount: "R/144 B16 K24 Y8 K8 WW8 K8 G32 R16 K8 R8 WW/8",
    palette: "R=RED;B=BLUE;K=BLACK;Y=YELLOW;WW=#F4F0E6#WILSON WHITE;G=GREEN;",
    shadeNote: `WW is Wilson's White, not on the Register colour sheet. ${SHADE_UNVERIFIED}`,
  },
  {
    id: "black-watch",
    name: "Black Watch",
    available: true,
    story:
      "Thought to have been designed in 1739, when the Highland Companies became the 42nd Regiment.",
    sourceUrl:
      "https://web.archive.org/web/20100428222504/http://www.tartansauthority.com/tartan-ferret/display/207/black-watch&surname=renfro&surname_search=",
    sourceLabel: "Archived Scottish Tartans Authority record",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=277",
    threadcount: "B/44 K4 B4 K4 B4 K32 G32 K4 G32 K32 B32 K4 B/4",
    palette: "B=BLUE;K=BLACK;G=GREEN;",
  },
  {
    id: "campbell",
    name: "Campbell",
    available: true,
    story: "The same sett as the Black Watch, in the lighter shades of this count.",
    sourceUrl:
      "https://web.archive.org/web/20110609020421/http://www.tartansauthority.com/tartan-ferret/display/1/campbell-clan",
    sourceLabel: "Archived Scottish Tartans Authority record",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=502",
    threadcount: "A/28 K6 A6 K6 A6 K32 OG32 K6 OG32 K32 A32 K6 A/6",
    palette: "A=#6A8FBF#AZURE;K=BLACK;OG=#5E6A32#OLIVE GREEN;",
    shadeNote: `A is Azure and OG is Olive Green, not on the Register colour sheet. ${SHADE_UNVERIFIED}`,
  },
  {
    id: "hunting-stewart",
    name: "Hunting Stewart",
    available: true,
    story:
      "Wilson 1819: recorded in Wilsons' pattern books, and repeated across the cloth with no mirror.",
    sourceUrl:
      "https://web.archive.org/web/20100626015445/http://www.tartansauthority.com/tartan-ferret/display/1916/stewart-htg-wilson-1819&surname=mckay&surname_search=",
    sourceLabel: "Archived Scottish Tartans Authority record",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=4005",
    threadcount:
      "...B9 G4 B9 K3 B3 K8 G27 R4 G27 K8 G5 K13 G4 K13 G5 K8 G27 Y4 G27 K8 B3 K3...",
    palette: "B=BLUE;G=GREEN;K=BLACK;R=RED;Y=YELLOW;",
  },
  {
    id: "balmoral",
    name: "Balmoral",
    available: true,
    story:
      "In use by 1852, traditionally linked with Prince Albert, and kept to the royal household by convention.",
    sourceUrl:
      "https://web.archive.org/web/20110105052532/http://www.tartansauthority.com/tartan-ferret/display/1300/balmoral-royal",
    sourceLabel: "Archived Scottish Tartans Authority record",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=182",
    threadcount:
      "LN/10 R6 LN48 DN14 K12 LN6 DN6 LN6 DN22 LN12 K6 LN6 R6 LN6 K6 LN12 DN22 LN6 DN6 LN6 K12 DN14 LN48 R/6",
    palette: "LN=LIGHT GREY;R=RED;DN=DARK GREY;K=BLACK;",
    countNote: "Converted by us, not quoted.",
    yarnNote:
      "Its grey is really a twisted black-and-white yarn, drawn as solid greys.",
  },
  {
    id: "dress-stewart",
    name: "Dress Stewart",
    available: false,
    availability: "not available",
    story:
      "A dress version of Royal Stewart, with yellow and white of equal size, thought to date from about 1850.",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=3999",
    reason: "The count is behind a sign-in. We don't guess it.",
  },
  {
    id: "macleod-of-lewis",
    name: "MacLeod of Lewis",
    available: false,
    availability: "not available",
    story: "Published in the Vestiarium Scoticum in 1842, and sometimes called Loud MacLeod.",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=2640",
    reason: "The count is behind a sign-in. We don't guess it.",
  },
  {
    id: "macdonald",
    name: "MacDonald",
    available: false,
    availability: "not available",
    story: "The oldest recorded version of the clan sett. Clan Donald has many others.",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=2334",
    reason: "The count is behind a sign-in. We don't guess it.",
  },
  {
    id: "isle-of-skye",
    name: "Isle of Skye",
    available: false,
    availability: "not available",
    story: "Angus MacLeod's 1992 competition design, first woven at Lochcarron in 1993.",
    registerUrl: "https://www.tartanregister.gov.uk/tartanDetails.aspx?ref=1868",
    reason: "The count is behind a sign-in. We don't guess it.",
  },
];

export const COMPARE_URL = "https://www.tartanregister.gov.uk/searchDesigns/exportable";
