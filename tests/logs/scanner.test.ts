import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { scanLogFiles, getDefaultLogDirs, extractProjectPath } from '../../src/logs/scanner.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('scanLogFiles', () => {
  it('returns empty array if dir does not exist', () => {
    const result = scanLogFiles('/nonexistent/path/that/does/not/exist')
    expect(result).toEqual([])
  })

  it('finds all .jsonl files recursively', () => {
    // Create nested structure with 3 jsonl files + 1 txt
    const subA = path.join(tmpDir, 'proj-a')
    const subB = path.join(tmpDir, 'proj-b', 'nested')
    fs.mkdirSync(subA, { recursive: true })
    fs.mkdirSync(subB, { recursive: true })

    const file1 = path.join(tmpDir, 'root.jsonl')
    const file2 = path.join(subA, 'session1.jsonl')
    const file3 = path.join(subB, 'session2.jsonl')
    const txtFile = path.join(subA, 'notes.txt')

    fs.writeFileSync(file1, '')
    fs.writeFileSync(file2, '')
    fs.writeFileSync(file3, '')
    fs.writeFileSync(txtFile, '')

    const result = scanLogFiles(tmpDir)
    expect(result).toHaveLength(3)
    expect(result).toContain(file1)
    expect(result).toContain(file2)
    expect(result).toContain(file3)
    expect(result).not.toContain(txtFile)
  })

  it('filters by .jsonl extension only', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.jsonl'), '')
    fs.writeFileSync(path.join(tmpDir, 'b.json'), '')
    fs.writeFileSync(path.join(tmpDir, 'c.log'), '')
    fs.writeFileSync(path.join(tmpDir, 'd.txt'), '')

    const result = scanLogFiles(tmpDir)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatch(/a\.jsonl$/)
  })

  it('returns sorted results', () => {
    fs.writeFileSync(path.join(tmpDir, 'z.jsonl'), '')
    fs.writeFileSync(path.join(tmpDir, 'a.jsonl'), '')
    fs.writeFileSync(path.join(tmpDir, 'm.jsonl'), '')

    const result = scanLogFiles(tmpDir)
    expect(result).toEqual([...result].sort())
  })

  it('returns empty array for empty directory', () => {
    expect(scanLogFiles(tmpDir)).toEqual([])
  })
})

describe('getDefaultLogDirs', () => {
  it('returns two paths based on home dir', () => {
    const dirs = getDefaultLogDirs()
    expect(dirs).toHaveLength(2)
    const home = os.homedir()
    expect(dirs[0]).toBe(path.join(home, '.claude', 'projects'))
    expect(dirs[1]).toBe(path.join(home, '.config', 'claude', 'projects'))
  })
})

describe('extractProjectPath', () => {
  it('decodes encoded project path', () => {
    const filePath = path.join('/home', 'user', '.claude', 'projects', '-Users-test-project', 'session.jsonl')
    expect(extractProjectPath(filePath)).toBe('/Users/test/project')
  })

  it('returns empty string if no projects segment', () => {
    expect(extractProjectPath('/some/other/path/file.jsonl')).toBe('')
  })

  it('returns empty string if projects is the last segment', () => {
    const filePath = path.join('/home', 'user', '.claude', 'projects')
    expect(extractProjectPath(filePath)).toBe('')
  })
})
