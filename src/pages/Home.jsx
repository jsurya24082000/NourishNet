import React from 'react'

const USER_TYPES = [
  {
    key: 'families',
    emoji: '🏠',
    title: 'Find Food Near You',
    description:
      'Search food pantries, meal programs, and mobile distributions across DC, Maryland, and Virginia.',
    cta: 'Find Resources',
    color: 'green',
  },
  {
    key: 'donors',
    emoji: '🤝',
    title: 'Make a Difference',
    description:
      'Donate food, funds, or supplies to local organizations fighting hunger in the DMV area.',
    cta: 'Start Donating',
    color: 'orange',
  },
  {
    key: 'volunteers',
    emoji: '🌱',
    title: 'Give Your Time',
    description:
      'Volunteer at food banks, pantries, and community kitchens. Every hour counts.',
    cta: 'Volunteer Now',
    color: 'blue',
  },
]

export default function Home({ navigate }) {
  return (
    <div>
      {/* Hero */}
      <section className="page-hero">
        <h1>Fighting Hunger Across the DMV</h1>
        <p>
          NourishNet connects families, donors, and volunteers with food resources in Washington
          DC, Maryland, and Virginia.
        </p>
      </section>

      {/* User type cards */}
      <div className="card-grid" style={{ marginBottom: '3rem' }}>
        {USER_TYPES.map((u) => (
          <div key={u.key} className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{u.emoji}</div>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>{u.title}</h3>
            <p style={{ marginBottom: '1.25rem' }}>{u.description}</p>
            <button
              className={`btn btn-${u.color}`}
              onClick={() => navigate(u.key)}
            >
              {u.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Stats strip */}
      <div
        style={{
          background: 'var(--green)',
          color: 'white',
          borderRadius: 'var(--radius)',
          padding: '1.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          textAlign: 'center',
        }}
      >
        {[
          { value: '10+', label: 'Partner Organizations' },
          { value: '3', label: 'Regions Covered' },
          { value: '1M+', label: 'Meals Distributed' },
          { value: '50K+', label: 'Families Served' },
        ].map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
