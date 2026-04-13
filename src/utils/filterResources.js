/**
 * Filter resources by region, category, and search query.
 * Matches against the `categories` array and state field from resources.json.
 *
 * @param {Array}  resources
 * @param {{ region: string, service: string, query: string }} filters
 * @returns {Array}
 */
export function filterResources(resources, { region = 'All', service = 'all', query = '' }) {
  return resources.filter((r) => {
    const matchRegion = region === 'All' || r.state === region
    const matchService = service === 'all' || (r.categories && r.categories.includes(service))
    const q = query.toLowerCase()
    const matchQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.address.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    return matchRegion && matchService && matchQuery
  })
}
