import type { UsJurisdictionCode } from '@/lib/compliance/types'

/**
 * The largest cities in each state, by population, for "where can I buy it in
 * <city>" searches (owner, 2026-09-28).
 *
 * These are NOT city pages. A page per city for a business with no premises there is
 * the doorway pattern Google and Bing penalise (CLAUDE.md rules 9 and 12). Instead the
 * one real page for each state names the cities it delivers to, in its snippet, its
 * delivery section and its answers, which is true, and useful to the person searching.
 */
export const STATE_CITIES: Record<UsJurisdictionCode, readonly string[]> = {
  AL: ['Huntsville', 'Birmingham', 'Montgomery', 'Mobile'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler'],
  AR: ['Little Rock', 'Fayetteville', 'Fort Smith', 'Springdale'],
  CA: ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins'],
  CT: ['Bridgeport', 'Stamford', 'New Haven', 'Hartford'],
  DE: ['Wilmington', 'Dover', 'Newark'],
  DC: ['Washington'],
  FL: ['Jacksonville', 'Miami', 'Tampa', 'Orlando'],
  GA: ['Atlanta', 'Columbus', 'Augusta', 'Savannah'],
  HI: ['Honolulu', 'Hilo', 'Kailua'],
  ID: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Rockford'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Iowa City'],
  KS: ['Wichita', 'Overland Park', 'Kansas City', 'Topeka'],
  KY: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette'],
  ME: ['Portland', 'Lewiston', 'Bangor'],
  MD: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Ann Arbor'],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester', 'Duluth'],
  MS: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg'],
  MO: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia'],
  MT: ['Billings', 'Missoula', 'Great Falls', 'Bozeman'],
  NE: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas'],
  NH: ['Manchester', 'Nashua', 'Concord'],
  NJ: ['Newark', 'Jersey City', 'Paterson', 'Trenton'],
  NM: ['Albuquerque', 'Las Cruces', 'Santa Fe', 'Rio Rancho'],
  NY: ['New York City', 'Buffalo', 'Rochester', 'Syracuse'],
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham'],
  ND: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow'],
  OR: ['Portland', 'Eugene', 'Salem', 'Bend'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie'],
  RI: ['Providence', 'Warwick', 'Cranston'],
  SC: ['Charleston', 'Columbia', 'North Charleston', 'Greenville'],
  SD: ['Sioux Falls', 'Rapid City', 'Aberdeen'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'],
  TX: ['Houston', 'San Antonio', 'Dallas', 'Austin'],
  UT: ['Salt Lake City', 'West Valley City', 'Provo', 'Ogden'],
  VT: ['Burlington', 'South Burlington', 'Rutland'],
  VA: ['Virginia Beach', 'Richmond', 'Norfolk', 'Arlington'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver'],
  WV: ['Charleston', 'Huntington', 'Morgantown'],
  WI: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha'],
  WY: ['Cheyenne', 'Casper', 'Laramie'],
}

function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** The delivery paragraph that names the cities. */
export function cityDelivery(code: UsJurisdictionCode, state: string): string {
  const cities = STATE_CITIES[code] ?? []
  if (code === 'DC') {
    return 'We deliver to every address in Washington, DC, from Capitol Hill to Georgetown and Anacostia, and the delivery cost for your address shows in the cart before you order.'
  }
  return `We deliver to every address in ${state}, from ${listOf(cities)} to the smallest rural route, at the same prices as everywhere else. The delivery cost for your address shows in the cart before you order.`
}

/**
 * Questions in the words buyers type into a search box or an AI assistant, answered
 * about the material and how to get it, not about us. The first sentence of each is
 * the answer; the rest is what a buyer needs next.
 */
export function cityQuestions(
  code: UsJurisdictionCode,
  state: string,
): readonly { readonly question: string; readonly answer: string }[] {
  const cities = (STATE_CITIES[code] ?? []).slice(0, 2)
  const where = cities.map((city) => ({
    question: `Where can I buy Mimosa hostilis root bark in ${city}?`,
    answer: `Online, from a specialist natural-dye supplier: Mimosa hostilis root bark is a specialist dye material that general craft stores rarely carry. It is sold by the pound as powder, shredded or whole bark, and ships to ${city} addresses with tracking. For dyeing wool, a pound covers one to two pounds of fiber in mid shades.`,
  }))
  return [
    ...where,
    {
      question: `Can you buy Mimosa hostilis root bark online in ${state}?`,
      answer: `Yes. Mimosa hostilis root bark is sold online as raw botanical material for natural dyeing, soap color and craft, and ships to addresses in ${state}. Buy it by weight: a quarter pound is enough for test skeins, a full pound for one to two pounds of wool. It is not for human consumption.`,
    },
    {
      question: `Which form of Mimosa hostilis root bark should I buy in ${state}?`,
      answer:
        'Shredded bark for most dyeing, because it strains cleanly and gives repeat baths; powder for small batches and soap, because it releases color fastest; whole chips and strips to stock up, because they keep longest. All three are the same bark, and the color they give is the same.',
    },
  ]
}

export { listOf as listCities }
