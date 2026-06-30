// src/components/RecordTable.jsx 상단 부분만 변경
// fetchRecords import 제거, useEffect/load 함수 제거, records를 props로 받기

import { useState } from 'react'

function formatValue(value) {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number') return value.toLocaleString()
    return String(value)
}

export default function RecordTable({ records }) {
    const fieldNames = [
        'Job Code', 'Project Name', 'Section', 'Description', 'Size', 'UNIT',
        'Qty', 'UNIT PRICE', 'TOTAL PRICE', 'Vendor',
    ]

    if (records.length === 0) return <p>No records found.</p>

    return (
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
            <tr>
                {fieldNames.map((name) => (
                    <th key={name}>{name}</th>
                ))}
            </tr>
            </thead>
            <tbody>
            {records.map((record) => (
                <tr key={record.id}>
                    {fieldNames.map((name) => (
                        <td key={name}>{formatValue(record.fields[name])}</td>
                    ))}
                </tr>
            ))}
            </tbody>
        </table>
    )
}