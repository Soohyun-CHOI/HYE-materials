// src/components/SearchTable/SearchTable.jsx
import {useState, useMemo} from 'react'
import styles from './SearchTable.module.css'

export default function SearchTable({records}) {
    const [query, setQuery] = useState('')
    const [selectedSections, setSelectedSections] = useState([])
    const [dropdownOpen, setDropdownOpen] = useState(false)

    const allSections = useMemo(() => {
        const set = new Set()
        records.forEach((r) => {
            const s = r.fields['Section']
            if (s) set.add(s.trim())  // trim으로 앞뒤 공백 제거
        })
        return Array.from(set).sort()
    }, [records])

    function toggleSection(section) {
        setSelectedSections((prev) =>
            prev.includes(section)
                ? prev.filter((s) => s !== section)
                : [...prev, section]
        )
    }

    function selectAll() {
        setSelectedSections([])
    }

    const sectionLabel =
        selectedSections.length === 0
            ? 'All Sections'
            : selectedSections.length === 1
                ? selectedSections[0]
                : `${selectedSections.length} sections selected`

    const filtered = useMemo(() => {
        const trimmed = query.trim().toLowerCase()

        const sectionFiltered = records.filter((record) => {
            if (selectedSections.length === 0) return true
            return selectedSections.includes((record.fields['Section'] ?? '').trim())
        })

        if (!trimmed) return []

        const prefixMatches = []
        const containsMatches = []

        sectionFiltered.forEach((record) => {
            const description = (record.fields['Description'] ?? '').toLowerCase().trim()
            if (description.startsWith(trimmed)) {
                prefixMatches.push(record)
            } else if (description.includes(trimmed)) {
                containsMatches.push(record)
            }
        })

        function sortByUnitPrice(arr) {
            return arr.sort((a, b) => {
                const priceA = a.fields['UNIT PRICE'] ?? null
                const priceB = b.fields['UNIT PRICE'] ?? null
                if (priceA === null) return 1
                if (priceB === null) return -1
                return priceA - priceB
            })
        }

        return [
            ...sortByUnitPrice(prefixMatches).map((r) => ({...r, _matchType: 'prefix'})),
            ...sortByUnitPrice(containsMatches).map((r) => ({...r, _matchType: 'contains'})),
        ]
    }, [query, selectedSections, records])

    const prefixCount = filtered.filter((r) => r._matchType === 'prefix').length
    const containsCount = filtered.filter((r) => r._matchType === 'contains').length

    return (
        <div className={styles.container}>
            <h2>Search by Description</h2>

            <div className={styles.controls}>

                <input
                    type="text"
                    placeholder="Enter description..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles.searchInput}
                />

                <div className={styles.dropdownWrapper}>
                    <button
                        onClick={() => setDropdownOpen((prev) => !prev)}
                        className={styles.dropdownButton}
                    >
                        {sectionLabel} ▾
                    </button>

                    {dropdownOpen && (
                        <div className={styles.dropdownMenu}>
                            <label className={styles.dropdownItem}>
                                <input
                                    type="checkbox"
                                    checked={selectedSections.length === 0}
                                    onChange={selectAll}
                                />
                                All Sections
                            </label>

                            <hr className={styles.dropdownDivider}/>

                            {allSections.map((section) => (
                                <label key={section} className={styles.dropdownItem}>
                                    <input
                                        type="checkbox"
                                        checked={selectedSections.includes(section)}
                                        onChange={() => toggleSection(section)}
                                    />
                                    {section}
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {dropdownOpen && (
                    <div
                        onClick={() => setDropdownOpen(false)}
                        className={styles.dropdownOverlay}
                    />
                )}
            </div>

            {query.trim() && filtered.length === 0 && (
                <p className={styles.emptyMessage}>No records found for "{query.trim()}".</p>
            )}

            {filtered.length > 0 && (
                <table className={styles.table}>
                    <thead>
                    <tr className={styles.tableHead}>
                        <th>Description</th>
                        <th>Project Name</th>
                        <th>Section</th>
                        <th>Vendor</th>
                        <th>Unit Price ↑</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.map((record, index) => {
                        const isFirstContains =
                            record._matchType === 'contains' && index === prefixCount

                        return (
                            <>
                                {isFirstContains && containsCount > 0 && (
                                    <tr key={`divider-${record.id}`} className={styles.dividerRow}>
                                        <td colSpan={5}>— Also contains "{query.trim()}"</td>
                                    </tr>
                                )}
                                <tr
                                    key={record.id}
                                    className={
                                        record._matchType === 'contains' ? styles.rowContains : styles.rowPrefix
                                    }
                                >
                                    <td>{record.fields['Description'] ?? ''}</td>
                                    <td>{record.fields['Project Name'] ?? ''}</td>
                                    <td>{record.fields['Section'] ?? ''}</td>
                                    <td>{record.fields['Vendor'] ?? ''}</td>
                                    <td>
                                        {record.fields['UNIT PRICE'] != null
                                            ? record.fields['UNIT PRICE'].toLocaleString()
                                            : ''}
                                    </td>
                                </tr>
                            </>
                        )
                    })}
                    </tbody>
                </table>
            )}
        </div>
    )
}