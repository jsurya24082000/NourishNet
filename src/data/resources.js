/**
 * Re-exports structured resource data from JSON files.
 * Components should import from here, not directly from JSON.
 */
import { RESOURCES } from './index.js'

export const resources = RESOURCES

export const REGIONS = ['All', 'DC', 'MD', 'VA']

export const SERVICE_TYPES = [
  { value: 'all',                label: 'All Services' },
  { value: 'food_pantry',        label: 'Food Pantry' },
  { value: 'food_bank',          label: 'Food Bank' },
  { value: 'meal_program',       label: 'Meal Program' },
  { value: 'mobile_distribution',label: 'Mobile Distribution' },
  { value: 'snap_assistance',    label: 'SNAP Assistance' },
  { value: 'children',           label: "Children's Programs" },
  { value: 'senior',             label: 'Senior Programs' },
  { value: 'job_training',       label: 'Job Training' },
  { value: 'social_services',    label: 'Social Services' },
]
