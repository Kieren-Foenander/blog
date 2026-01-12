import matter from 'gray-matter'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

export interface PostMetadata {
  title: string
  date: string
  description?: string
  heroImage?: string
  [key: string]: string | number | boolean | undefined
}

export interface Post {
  slug: string
  metadata: PostMetadata
  content: string
}

const postsDirectory = join(process.cwd(), 'posts')

export function getPostSlugs(): string[] {
  try {
    const files = readdirSync(postsDirectory)
    return files
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
  } catch {
    return []
  }
}

export function getPostBySlug(slug: string): Post | null {
  try {
    const fullPath = join(postsDirectory, `${slug}.md`)
    const fileContents = readFileSync(fullPath, 'utf8')
    const { data, content } = matter(fileContents)

    console.log('Parsed frontmatter:', data)
    console.log('Content:', content)

    return {
      slug,
      metadata: {
        title: data.title || 'Untitled',
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || '',
        ...data,
      },
      content,
    }
  } catch {
    return null
  }
}

export function getAllPosts(): Post[] {
  const slugs = getPostSlugs()
  const posts = slugs
    .map((slug) => getPostBySlug(slug))
    .filter((post): post is Post => post !== null)

  // Sort by date, newest first
  return posts.sort((a, b) => {
    const dateA = new Date(a.metadata.date).getTime()
    const dateB = new Date(b.metadata.date).getTime()
    return dateB - dateA
  })
}
