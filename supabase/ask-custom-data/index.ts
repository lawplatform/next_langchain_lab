// @ts-nocheck
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import 'https://deno.land/x/xhr@0.2.1/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.5.0'
import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer@1.1.5'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.1.0'
import { stripIndent, oneLine } from 'https://esm.sh/common-tags@1.8.2'
import supabaseClient from './supabase'
export const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


serve(async (req) => {
	// ask-custom-data logic
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders })
	}

	// Search query is passed in request payload
	const { query } = await req.json()

	// OpenAI recommends replacing newlines with spaces for best results
	const input = query.replace(/\n/g, ' ')
	console.log(input);
	const openAi = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API })
	// Generate a one-time embedding for the query itself
	const embeddingResponse = await openAi.embeddings.create({
		model: 'text-embedding-ada-002',
		input,
	})

	const [{ embedding }] = embeddingResponse.data

	// get the relevant documents to our question by using the match_documents
	// rpc: call PostgreSQL functions in supabase
	const { data: documents, error } = await supabaseClient.rpc('match_documents', {
		query_embedding: embedding,
		match_threshold: .73, // Choose an appropriate threshold for your data
		match_count: 10, // Choose the number of matches
	})

	if (error) throw error
	// documents is going to be all the relevant data to our specific question.

	const tokenizer = new GPT3Tokenizer({ type: 'gpt3' })
	let tokenCount = 0
	let contextText = ''

	// Concat matched documents
	for (let i = 0; i < documents.length; i++) {
		const document = documents[i]
		const content = document.content
		const encoded = tokenizer.encode(content)
		tokenCount += encoded.text.length

		// Limit context to max 1500 tokens (configurable)
		if (tokenCount > 1500) {
			break
		}

		contextText += `${content.trim()}---\n`
	}

	const prompt = stripIndent`${oneLine`
    당신은 로플랫폼을 대표하는 홍보전문가입니다. 말할 수 있는 가장 진실된 답변을 해주세요"`}
    참고:
    ${contextText}
    질문: """
    ${query}
    """
    간단한 답변을 말해주세요:
  `

	// get response from text-davinci-003 model
	const completionResponse = await openai.createCompletion({
		model: 'text-davinci-003',
		prompt,
		max_tokens: 512, // Choose the max allowed tokens in completion
		temperature: 0, // Set to 0 for deterministic results
	})

	const {
		id,
		choices: [{ text }],
	} = completionResponse.data

	// return the response from the model to our use through a Response
	return new Response(JSON.stringify({ id, text }), {
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	})
})
