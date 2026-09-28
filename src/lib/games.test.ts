import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGamesByFilters,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

interface FilterFixtures {
    categoryIds: { puzzle: number; strategy: number };
    publisherIds: { alpha: number; beta: number };
}

async function seedFilterFixtures(db: Database): Promise<FilterFixtures> {
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'Puzzle games' })
        .returning({ id: categories.id });
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'Strategy games' })
        .returning({ id: categories.id });
    const [alpha] = await db
        .insert(publishers)
        .values({ name: 'Alpha', description: 'Publisher Alpha' })
        .returning({ id: publishers.id });
    const [beta] = await db
        .insert(publishers)
        .values({ name: 'Beta', description: 'Publisher Beta' })
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Puzzle Alpha',
            description: 'Puzzle game from Alpha',
            starRating: 4,
            categoryId: puzzle.id,
            publisherId: alpha.id,
        },
        {
            title: 'Strategy Alpha',
            description: 'Strategy game from Alpha',
            starRating: 4,
            categoryId: strategy.id,
            publisherId: alpha.id,
        },
        {
            title: 'Puzzle Beta',
            description: 'Puzzle game from Beta',
            starRating: 4,
            categoryId: puzzle.id,
            publisherId: beta.id,
        },
        {
            title: 'Strategy Beta',
            description: 'Strategy game from Beta',
            starRating: 4,
            categoryId: strategy.id,
            publisherId: beta.id,
        },
    ]);

    return {
        categoryIds: { puzzle: puzzle.id, strategy: strategy.id },
        publisherIds: { alpha: alpha.id, beta: beta.id },
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by one or more categories in title order', async () => {
        const { categoryIds } = await seedFilterFixtures(db);

        const games = await getGamesByFilters(db, {
            categoryIds: [categoryIds.strategy, categoryIds.puzzle],
        });

        expect(games.map((game) => game.title)).toEqual([
            'Puzzle Alpha',
            'Puzzle Beta',
            'Strategy Alpha',
            'Strategy Beta',
        ]);
    });

    it('filters games by publisher', async () => {
        const { publisherIds } = await seedFilterFixtures(db);

        const games = await getGamesByFilters(db, { publisherId: publisherIds.beta });

        expect(games.map((game) => game.title)).toEqual(['Puzzle Beta', 'Strategy Beta']);
    });

    it('combines category and publisher filters', async () => {
        const { categoryIds, publisherIds } = await seedFilterFixtures(db);

        const games = await getGamesByFilters(db, {
            categoryIds: [categoryIds.puzzle, categoryIds.strategy],
            publisherId: publisherIds.beta,
        });

        expect(games.map((game) => game.title)).toEqual(['Puzzle Beta', 'Strategy Beta']);
    });

    it('treats an empty category selection as no category constraint', async () => {
        const { publisherIds } = await seedFilterFixtures(db);

        const games = await getGamesByFilters(db, { categoryIds: [], publisherId: publisherIds.alpha });

        expect(games.map((game) => game.title)).toEqual(['Puzzle Alpha', 'Strategy Alpha']);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
