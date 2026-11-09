import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePagination } from '../src/utils/pagination.js'

test('18 items, 9 per page -> 2 pages, first page', () => {
  assert.deepEqual(computePagination(18, 1, 9), {
    totalPages: 2,
    startIndex: 0,
    endIndex: 9,
    hasPrev: false,
    hasNext: true,
  })
})

test('second page of 18 items', () => {
  const p = computePagination(18, 2, 9)
  assert.equal(p.startIndex, 9)
  assert.equal(p.endIndex, 18)
  assert.equal(p.hasPrev, true)
  assert.equal(p.hasNext, false)
})

test('empty list still reports one page', () => {
  assert.equal(computePagination(0, 1, 9).totalPages, 1)
})

test('partial last page is not overshot', () => {
  assert.equal(computePagination(20, 3, 9).endIndex, 20)
})
