// src/components/FileUpload.jsx
// Currently this just wires up the frontend to send a file to the
// /api/parse-file serverless function. Implement the actual parsing
// logic (OCR, AI extraction, etc.) inside api/parse-file.js.
import { useState } from 'react'

export default function FileUpload({ onParsed }) {
  const [status, setStatus] = useState('idle') // idle | uploading | done | error
  const [message, setMessage] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('uploading')
    setMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/parse-file', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setStatus('done')
      setMessage(`${data.recordsCreated ?? 0} record(s) created.`)
      onParsed?.(data)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  return (
    <div style={{ margin: '16px 0' }}>
      <label>
        Upload file (auto-parse):{' '}
        <input type="file" onChange={handleFileChange} disabled={status === 'uploading'} />
      </label>
      {status === 'uploading' && <p>Processing...</p>}
      {status === 'done' && <p style={{ color: 'green' }}>{message}</p>}
      {status === 'error' && <p style={{ color: 'red' }}>Error: {message}</p>}
    </div>
  )
}
