import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { articles, galleryItems, galleryPreviewItems, photos, programs, projects, team } from '../../../src/data/content.js'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const sourceDirectory = join(projectRoot, 'media-originals')
const outputDirectory = join(projectRoot, 'public', 'images')
const galleryOutputDirectory = join(outputDirectory, 'gallery')
const archiveFilenames = (await readdir(sourceDirectory)).filter((filename) => /\.jpe?g$/i.test(filename))
const imageReferences = new Set()

function collectImageReferences(value) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\/images\/[^"'`\s),]+/g)) imageReferences.add(match[0])
  } else if (Array.isArray(value)) {
    value.forEach(collectImageReferences)
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(collectImageReferences)
  }
}

async function collectSourceImageReferences(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectSourceImageReferences(entryPath)
    } else if (/\.(?:js|jsx|ts|tsx|css|html)$/i.test(entry.name)) {
      const source = await readFile(entryPath, 'utf8')
      for (const match of source.matchAll(/\/images\/[^"'`\s),]+/g)) imageReferences.add(match[0])
    }
  }
}

collectImageReferences({ articles, galleryItems, galleryPreviewItems, photos, programs, projects, team })
await collectSourceImageReferences(join(projectRoot, 'src'))

const referencedImageStems = new Set(
  [...imageReferences]
    .filter((imagePath) => !imagePath.includes('${'))
    .map((imagePath) => imagePath.match(/^\/images\/([^/]+)\.webp$/i)?.[1]?.toLowerCase())
    .filter(Boolean),
)
const sourceImageStems = new Set(
  archiveFilenames.map((filename) => filename.replace(/\.jpe?g$/i, '').toLowerCase()),
)
const missingOriginals = [...referencedImageStems].filter((stem) => !sourceImageStems.has(stem))
if (missingOriginals.length) throw new Error(`Missing originals for referenced images: ${missingOriginals.join(', ')}`)

const filenames = archiveFilenames.filter((filename) =>
  referencedImageStems.has(filename.replace(/\.jpe?g$/i, '').toLowerCase()),
)

if (!filenames.length) throw new Error('No source JPEG images were found in media-originals.')

await mkdir(outputDirectory, { recursive: true })
await mkdir(galleryOutputDirectory, { recursive: true })
let sourceBytes = 0
let outputBytes = 0
let galleryThumbnailBytes = 0
const galleryFilenames = new Set(
  galleryItems.map((item) => item.image.split('/').pop().replace(/\.webp$/i, '').toLowerCase()),
)

for (const filename of filenames) {
  const sourcePath = join(sourceDirectory, filename)
  const outputPath = join(outputDirectory, filename.replace(/\.jpe?g$/i, '.webp'))
  const sourceInfo = await stat(sourcePath)
  const outputInfo = await sharp(sourcePath)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toFile(outputPath)
  sourceBytes += sourceInfo.size
  outputBytes += outputInfo.size

  if (galleryFilenames.has(filename.replace(/\.jpe?g$/i, '').toLowerCase())) {
    const imageName = filename.replace(/\.jpe?g$/i, '')
    for (const width of [480, 960]) {
      const thumbnailInfo = await sharp(sourcePath)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width === 480 ? 72 : 78, effort: 5 })
        .toFile(join(galleryOutputDirectory, `${imageName}-${width}.webp`))
      galleryThumbnailBytes += thumbnailInfo.size
    }
  }
}

console.log(JSON.stringify({ images: filenames.length, sourceBytes, outputBytes, galleryThumbnails: galleryItems.length * 2, galleryThumbnailBytes }))
