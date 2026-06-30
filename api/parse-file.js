// api/parse-file.js
// Vercel Serverless Function skeleton.
// The Airtable token is only used here (server-side environment variable),
// so it is never exposed to the client.
//
// Add your actual parsing logic (OCR, PDF text extraction, AI extraction, etc.)
// in the TODO sections below.

export const config = {
  api: {
    bodyParser: false, // disabled to handle multipart/form-data file uploads manually
  },
}

const BASE_ID = process.env.AIRTABLE_BASE_ID
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME
const TOKEN = process.env.AIRTABLE_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // TODO 1: Read the uploaded file from req (e.g. using a library like formidable or busboy)
    // const file = await parseMultipartFile(req)

    // TODO 2: Parse the file content into structured data
    // const extractedRows = await parseFileToRows(file)
    const extractedRows = [
      // Placeholder dummy data — replace with the actual parsing result
      { Name: 'Sample data', Amount: 1000 },
    ]

    // TODO 3: Write the parsed data to Airtable
    const airtableRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: extractedRows.map((fields) => ({ fields })),
        }),
      }
    )

    if (!airtableRes.ok) {
      const errText = await airtableRes.text()
      throw new Error(`Airtable write failed: ${airtableRes.status} ${errText}`)
    }

    const result = await airtableRes.json()

    return res.status(200).json({
      recordsCreated: result.records?.length ?? 0,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
