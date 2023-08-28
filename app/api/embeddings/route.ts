import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'


export const dynamic = 'force-dynamic'

const getDocuments = async () => {
	return ([
		"로플릇폼의 고객센터 전화번호는 010 9563 5784이다 "
	])
}
export async function GET() {
	// Create a Supabase client configured to use cookies
	const supabase = createRouteHandlerClient({ cookies })
	const openAi = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API })
	// const { data: todos } = await supabase.from('todos').select()
	const documents = await getDocuments() // Your custom function to load docs

	// Assuming each document is a string
	for (const document of documents) {
		// OpenAI recommends replacing newlines with spaces for best results
		const input = document.replace(/\n/g, ' ')

		const embeddingResponse = await openAi.embeddings.create({
			model: 'text-embedding-ada-002',
			input,
		})

		const [{ embedding }] = embeddingResponse.data

		// In production we should handle possible errors
		await supabase.from('documents').insert({
			content: document,
			embedding,
		})

	}
	return NextResponse.json({ data: "embeding complete" })
}
