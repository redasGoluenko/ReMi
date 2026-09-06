export type PaintingAuthor = 'redas' | 'migle'

export interface Painting {
  id: string
  author: PaintingAuthor
  imageData: string
  createdAt: string
}
