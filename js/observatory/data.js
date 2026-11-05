// Everything the 3D Observatory says lives here, so adding a project means editing
// this file only. Figures are star-chart drawings: each stroke is a list of [x, y]
// points, and every point becomes a star. Only real projects get a bright star.

const ring = (cx, cy, r, n = 8) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

const CAR = [
  [[-13, -5], [-18, -5], [-18, 2], [-12, 3], [-9, 11], [8, 11], [14, 3], [18, 2], [18, -5], [14, -5]],
  [[-5, -5], [6, -5]],
  ring(-9, -5.5, 3.6),
  ring(10, -5.5, 3.6),
];

export const ROOMS = {
  cars: {
    title: 'Cars & Flips',
    figure: 'The Car',
    page: 'cars.html',
    color: '#FF7A59',
    intro: 'I learned to work on cars by buying a $350 Honda Element I had no idea how to fix. This is where the craft and the business side meet.',
    strokes: CAR,
    projects: [
      {
        title: 'The $350 Honda Element',
        hook: 'Bought it broken, sold it after the emissions test blew up the plan.',
        meta: 'Apr 2022 to Dec 2023',
        tag: 'Sold, $400 profit',
        page: 'cars-honda-element.html',
        at: [-9, 11],
      },
    ],
  },
  code: {
    title: 'Code & CS',
    figure: 'The Bracket',
    page: 'code.html',
    color: '#5BD8C4',
    intro: "I came into tech from the hardware side, buying broken computers and making them work again. What keeps me here is the kind of problem where the data gets to tell me I'm wrong.",
    strokes: [
      [[-16, 9], [-27, 0], [-16, -9]],
      [[-5, -13], [5, 13]],
      [[16, 9], [27, 0], [16, -9]],
    ],
    projects: [
      {
        title: 'Mapping 142 Fatal Avalanches',
        hook: '800 data points, six hypotheses, half of them wrong.',
        meta: 'May 2023 to Mar 2024',
        tag: 'Data, Unreal Engine',
        page: 'code-avalanche-data.html',
        at: [-27, 0],
      },
      {
        title: 'Flipping Computers, Not Just Cars',
        hook: 'A refurbishing business that worked, until a supply shock ended it.',
        meta: '2021 to 2022',
        tag: 'Profitable, then shut down',
        page: 'code-computer-refurb.html',
        at: [27, 0],
      },
    ],
  },
  creative: {
    title: 'Creative',
    figure: 'The Needle',
    page: 'creative.html',
    color: '#9B8CFF',
    intro: 'Making things is where I learned to stay with something hard. That includes a game I spent two years building in Unreal Engine 5, and sewing, which lives here alongside everything else.',
    strokes: [
      [[-20, -13], [16, 13]],
      ring(17.5, 14, 2, 6),
      [[17.5, 12], [24, 4], [13, -3], [21, -11], [8, -15], [-3, -10]],
    ],
    projects: [
      {
        title: 'Two Years, One Game',
        hook: 'A project built to test whether I could stop quitting when things got hard.',
        meta: 'Sept 2021 to Sept 2023',
        tag: 'Unreal Engine 5',
        page: 'creative-game-design.html',
        at: [24, 4],
      },
    ],
  },
  atlas: {
    title: 'The Atlas',
    figure: 'The Open Book',
    page: 'atlas.html',
    color: '#C9D2F0',
    scale: 0.72,
    intro: "This is the part of the site that's still being made: short, loose notes on how I think and what I notice, added as I go. It's meant to look sparse for now.",
    strokes: [
      [[-16, -7], [-16, 8], [0, 4], [16, 8], [16, -7], [0, -11], [-16, -7]],
      [[0, 4], [0, -11]],
    ],
    projects: [],
  },
};

export const WAYPOINTS = [
  {
    when: '2021',
    title: 'Started refurbishing computers',
    text: 'Bought old, broken computers off eBay, yard sales, and Facebook Marketplace, fixed them up, and resold them through word of mouth. Made real money at it, until COVID-era part shortages and inflation made the business stop making sense.',
    color: '#5BD8C4',
    page: 'code-computer-refurb.html',
    linkText: 'See the business',
    strokes: [
      [[-14, 11], [14, 11], [14, -6], [-14, -6], [-14, 11]],
      [[-3, -6], [-4, -12], [4, -12], [3, -6]],
      [[-8, -12], [8, -12]],
    ],
  },
  {
    when: '2022 to 2023',
    title: 'Bought a $350 project car',
    text: "Took on a full car restoration as a practical skills project: budgeting, negotiating, using tools I'd never touched. It didn't go entirely to plan, but it sold.",
    color: '#FF7A59',
    page: 'cars-honda-element.html',
    linkText: 'See the build',
    strokes: CAR,
  },
  {
    when: '2023 to 2024',
    title: 'Analyzed 142 fatal avalanches',
    text: 'Pulled 800 data points from the Colorado Avalanche Information Center, formed six hypotheses about what makes an avalanche deadly, and was wrong about half of them, which turned out to be the more interesting result.',
    color: '#5BD8C4',
    page: 'code-avalanche-data.html',
    linkText: 'See the analysis',
    strokes: [
      [[-24, -11], [-9, 12], [-3, 3], [3, 8], [20, -11], [-24, -11]],
      [[-9, 12], [-13, 2], [-6, -2], [-11, -11]],
    ],
  },
  {
    when: '2024',
    title: 'Led a four-day backpacking trip',
    text: 'Took a group of new students through a multi-day trip in the Colorado backcountry as a student leader, the culmination of three years of smaller leadership roles before it.',
    color: '#E8B95B',
    strokes: [
      [[-20, -9], [-7, 10], [0, 0], [6, 7], [20, -9]],
      [[-6, -9], [0, 0], [6, -9], [-6, -9]],
    ],
  },
  {
    when: 'Now',
    title: 'Here',
    text: "I'm at [school or job], working on [current focus]. Next, I'm aiming at [goal].",
    color: '#E8B95B',
    strokes: [
      [[0, 15], [3, 3], [15, 0], [3, -3], [0, -15], [-3, -3], [-15, 0], [-3, 3], [0, 15]],
    ],
  },
];
