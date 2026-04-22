import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

let testEnv;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'gym-manager-test',
        firestore: {
            rules: readFileSync(resolve(__dirname, 'DRAFT_firestore.rules'), 'utf8'),
        },
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

describe('Firestore Rules', () => {
    it('should deny unauthorized access entirely', async () => {
        const unauth = testEnv.unauthenticatedContext();
        await assertFails(unauth.firestore().collection('alumnas').get());
    });

    // We will expand these if necessary.
});
