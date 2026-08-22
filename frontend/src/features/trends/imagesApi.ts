import { api } from '@/lib/api'

export interface SnippetImage {
  id: number
  type: 'code_snippet' | 'prompt' | 'manual_upload'
  status: 'pending' | 'ready' | 'failed'
  spec: { code: string; language: string; title: string } | null
  prompt_text: string | null
  url: string | null
  width: number | null
  height: number | null
}

export function fetchPostImages(postId: number): Promise<{
  snippet: SnippetImage | null
  failedSnippet: SnippetImage | null
  pendingSnippet: SnippetImage | null
  prompts: SnippetImage[]
  uploads: SnippetImage[]
}> {
  return api<{ data: SnippetImage[] }>(`/posts/${postId}/images`).then(({ data }) => ({
    snippet:
      (data.filter((i) => i.type === 'code_snippet' && i.status === 'ready').at(-1) as
        | SnippetImage
        | undefined) ?? null,
    pendingSnippet:
      (data.filter((i) => i.type === 'code_snippet' && i.status === 'pending').at(-1) as
        | SnippetImage
        | undefined) ?? null,
    failedSnippet:
      (data.filter((i) => i.type === 'code_snippet' && i.status === 'failed').at(-1) as
        | SnippetImage
        | undefined) ?? null,
    prompts: data.filter((i) => i.type === 'prompt'),
    uploads: data.filter((i) => i.type === 'manual_upload'),
  }))
}

export function suggestSnippet(postId: number, force: boolean): Promise<unknown> {
  return api(`/posts/${postId}/images/snippet`, {
    method: 'POST',
    body: { force },
  })
}

export function generateImagePrompt(postId: number): Promise<unknown> {
  return api(`/posts/${postId}/images/prompt`, { method: 'POST' })
}

export function uploadImage(postId: number, file: File): Promise<unknown> {
  const form = new FormData()
  form.append('image', file)

  const token = localStorage.getItem('td_token')

  return fetch(`/api/posts/${postId}/images/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (response) => {
    if (!response.ok) throw new Error('Upload failed')
    return response.json()
  })
}

export function deleteImage(id: number): Promise<unknown> {
  return api(`/images/${id}`, { method: 'DELETE' })
}
