# Firestore Data Modeling Guideline

## Many-to-Many Relationship Design Pattern

When implementing many-to-many relationships between users and entities (exhibitions, products, posts, etc.), adopt the **intermediate collection pattern**.

### Recommended Design Approach

- Create a dedicated intermediate collection (junction table) instead of storing entity IDs as arrays in documents
- Design each relationship as a single document (userId + entityId pair)
- Enable bidirectional queries and flexible addition of attributes in the future

### Collection Structure Examples

#### Bookmark Feature

Example structure with a top-level `bookmarks` collection:

```
collections/
├── users/
│   └── {uid}
│       ├── email: string
│       ├── displayName: string
│       └── ...
├── exhibitions/
│   └── {exhibitionId}
│       ├── title: string
│       ├── venue: string
│       └── ...
└── bookmarks/ (intermediate collection)
    └── {bookmarkId}  // Example: "{userId}_{exhibitionId}" ensures uniqueness
        ├── userId: string
        ├── exhibitionId: string
        └── createdAt: Timestamp
```

### Document ID Design

#### Composite ID Pattern (Recommended)

```typescript
const bookmarkId = `${userId}_${exhibitionId}`
```

**Advantages:**
- Ensures uniqueness constraint at the application layer
- Fast existence check for specific relationships (directly check with `.doc(bookmarkId).get()`)
- Easy prevention of duplicate entries

**Considerations:**
- Be aware of ID length limit (1500 bytes, usually not an issue)

#### Auto-generated ID Pattern

```typescript
const bookmarkRef = db.collection('bookmarks').doc()  // Firestore auto-generates
```

**Advantages:**
- Simple implementation
- No need to worry about ID collisions

**Disadvantages:**
- Need to implement uniqueness constraint separately (existence check via query → transaction processing)
- Requires additional query for existence check

### Why Not Array or Subcollection Patterns?

#### ❌ Storing entityId array in users document

```typescript
// Anti-pattern
users/{uid}
  preferences:
    bookmarkedExhibitions: [exhibitionId1, exhibitionId2, ...]  // ❌
```

**Issues:**
- Risk of approaching 1MB document size limit as array grows
- Difficult to reverse-query "users who bookmarked a specific entity"
- Hard to add metadata (creation time, memo, etc.) to individual relationships
- Complex concurrency control when updating arrays

#### ❌ Storing userId array in entity document

```typescript
// Anti-pattern
exhibitions/{exhibitionId}
  bookmarkedBy: [userId1, userId2, ...]  // ❌
```

**Issues:**
- Popular entities can easily reach 1MB limit with many user IDs
- High write cost and contention when updating large arrays
- Lacks scalability

#### △ users/{uid}/bookmarks Subcollection

```typescript
users/{uid}/bookmarks/{exhibitionId}
  exhibitionId: string
  createdAt: Timestamp
```

**Advantages:**
- Easy to retrieve "bookmarks list for a specific user"
- Clear data separation per user

**Disadvantages:**
- Requires [Collection Group Query](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query) to retrieve "users who bookmarked a specific entity"
- Slightly complex security rules and index design
- Can be cumbersome for analytics and reporting in admin interfaces

**Conclusion:**
When bidirectional queries are needed and future analysis/expansion is considered, the **top-level intermediate collection pattern** provides the best balance.

### Query Pattern Examples

#### Get bookmark list for a specific user

```typescript
const bookmarksSnapshot = await db
  .collection('bookmarks')
  .where('userId', '==', uid)
  .orderBy('createdAt', 'desc')
  .get()

const exhibitionIds = bookmarksSnapshot.docs.map(doc => doc.data().exhibitionId)
```

#### Get list of users who bookmarked a specific entity

```typescript
const bookmarksSnapshot = await db
  .collection('bookmarks')
  .where('exhibitionId', '==', exhibitionId)
  .get()

const userIds = bookmarksSnapshot.docs.map(doc => doc.data().userId)
```

#### Check if a specific relationship exists (composite ID case)

```typescript
const bookmarkId = `${userId}_${exhibitionId}`
const bookmarkDoc = await db.collection('bookmarks').doc(bookmarkId).get()
const isBookmarked = bookmarkDoc.exists
```

### Adding Metadata

The intermediate collection pattern makes it easy to add additional information to relationships:

```typescript
bookmarks/{bookmarkId}
  userId: string
  exhibitionId: string
  createdAt: Timestamp
  memo: string           // User's memo
  notificationEnabled: boolean  // Notification enabled/disabled
```

### Performance Optimization

#### Creating Indexes

Firestore requires appropriate indexes for composite queries:

```
bookmarks collection:
  - Index: userId (asc), createdAt (desc)
  - Index: exhibitionId (asc), createdAt (desc)
```

#### Batch Processing

Use pagination when retrieving large numbers of bookmarks:

```typescript
const LIMIT = 50

const bookmarksSnapshot = await db
  .collection('bookmarks')
  .where('userId', '==', uid)
  .orderBy('createdAt', 'desc')
  .limit(LIMIT)
  .get()
```

### Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Favorites collection rules
    match /favorites/{favoriteId} {
      // Allow read only for own favorites
      allow read: if request.auth != null
                  && resource.data.userId == request.auth.uid;

      // Allow create only for own favorites with required fields
      // Note: exists() validation adds a document read cost
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.keys().hasAll(['userId', 'museumId', 'createdAt'])
                    && exists(/databases/$(database)/documents/museum/$(request.resource.data.museumId));

      // Allow delete only for own favorites
      allow delete: if request.auth != null
                    && resource.data.userId == request.auth.uid;

      // Disallow updates (use delete → recreate instead)
      allow update: if false;
    }

    // Bookmarks collection rules
    match /bookmarks/{bookmarkId} {
      // Allow read only for own bookmarks
      allow read: if request.auth != null
                  && resource.data.userId == request.auth.uid;

      // Allow create only for own bookmarks with required fields
      // Note: exists() validation adds a document read cost
      allow create: if request.auth != null
                    && request.resource.data.userId == request.auth.uid
                    && request.resource.data.keys().hasAll(['userId', 'exhibitionId', 'createdAt'])
                    && exists(/databases/$(database)/documents/exhibition/$(request.resource.data.exhibitionId));

      // Allow delete only for own bookmarks
      allow delete: if request.auth != null
                    && resource.data.userId == request.auth.uid;

      // Disallow updates (use delete → recreate instead)
      allow update: if false;
    }
  }
}
```

#### Referential Integrity Validation

The security rules above include referential integrity checks using `exists()`:
- `favorites` validates that the `museumId` exists in the `museum` collection
- `bookmarks` validates that the `exhibitionId` exists in the `exhibition` collection

**Benefits:**

- Prevents creation of orphaned relationships (favorites/bookmarks pointing to non-existent entities)
- Ensures data integrity at the database level
- Provides clear security boundary

**Cost Considerations:**

- Each `exists()` check adds **one document read** to the operation
- For create operations: 2 reads (the exists check + the document being created)
- This is acceptable for user-initiated actions with low frequency

**Best Practice:**

Combine API-level validation with security rules for defense in depth:

```typescript
// API validates first (better UX - returns specific error)
const museumDoc = await db.collection('museum').doc(museumId).get()
if (!museumDoc.exists) {
  return NextResponse.json({ error: 'Museum not found' }, { status: 404 })
}

// Security rules validate as final safeguard
// Even if API is bypassed, rules will catch invalid references
```

### Implementation Checklist

Items to verify when implementing the intermediate collection pattern:

- [ ] Create top-level intermediate collection (e.g., `bookmarks`)
- [ ] Adopt composite ID (`{userId}_{entityId}`) for document ID
- [ ] Create necessary indexes in Firebase Console
- [ ] Configure authentication/authorization appropriately in security rules
- [ ] Implement toggle operation (add/delete) in API endpoint
- [ ] Implement optimistic UI updates on client side (for better UX)
- [ ] Implement error handling and rollback processing

## Firestore Transactions - Best Practices

### When to Use Transactions

Use transactions to prevent race conditions when operations involve:

1. **Check-then-Write**: Reading data to make a decision, then writing based on that decision
2. **Atomic Updates**: Multiple writes that must succeed or fail together
3. **Counters and Limits**: Enforcing constraints (e.g., maximum number of items)

### Common Race Condition: TOCTOU (Time-of-Check-Time-of-Use)

**Problem Scenario:**
```typescript
// ❌ RACE CONDITION - DO NOT USE
const favoritesSnapshot = await db.collection('favorites').where('userId', '==', uid).get()

if (favoritesSnapshot.size >= 1) {
  return error('Limit exceeded')
}

// Between check and write, another request could create a favorite
await favoriteRef.set(newFavorite)  // User can bypass limit!
```

**Concurrent Request Timeline:**
1. Request A: Checks count → 0 favorites ✓
2. Request B: Checks count → 0 favorites ✓
3. Request A: Creates favorite → User has 1 favorite
4. Request B: Creates favorite → User has 2 favorites (limit bypassed!)

### Solution: Use Transactions

**Correct Implementation:**
```typescript
// ✅ ATOMIC - USE THIS
await db.runTransaction(async (transaction) => {
  // 1. Read phase: All reads must happen first
  const favoriteDoc = await transaction.get(favoriteRef)

  if (favoriteDoc.exists) {
    transaction.delete(favoriteRef)
    return { favorited: false }
  }

  // Check limit within transaction
  const favoritesSnapshot = await transaction.get(
    db.collection('favorites').where('userId', '==', uid)
  )

  if (favoritesSnapshot.size >= 1) {
    throw new Error('LIMIT_EXCEEDED')
  }

  // 2. Write phase: All writes happen after reads
  const newFavorite = {
    userId: uid,
    museumId,
    createdAt: Timestamp.now(),
  }
  transaction.set(favoriteRef, newFavorite)
  return { favorited: true }
})
```

### Transaction Rules and Best Practices

#### 1. Read-Then-Write Pattern
- **All reads must happen before any writes**
- Firestore locks read documents during the transaction
- Writes are applied atomically at commit time

```typescript
await db.runTransaction(async (transaction) => {
  // ✅ Correct: All reads first
  const doc1 = await transaction.get(ref1)
  const doc2 = await transaction.get(ref2)

  // Then all writes
  transaction.update(ref1, { count: doc1.data().count + 1 })
  transaction.set(ref2, newData)
})

// ❌ Incorrect: Interleaving reads and writes
await db.runTransaction(async (transaction) => {
  const doc1 = await transaction.get(ref1)
  transaction.update(ref1, { count: doc1.data().count + 1 })  // Write before reading doc2
  const doc2 = await transaction.get(ref2)  // This will fail or cause issues
})
```

#### 2. Maximum Document Limit
- Transactions can read/write up to **500 documents**
- Exceeding this limit will cause the transaction to fail
- For batch operations beyond this limit, use batched writes instead

#### 3. Automatic Retries
- Firestore automatically retries transactions on conflicts
- Design transactions to be **idempotent** (safe to retry)
- Avoid side effects like:
    - Sending emails
    - Making external API calls
    - Logging to external services

#### 4. Transaction Timeout
- Transactions have a **270-second timeout** (4.5 minutes)
- Keep transactions fast to avoid timeouts
- Complex logic should be performed outside the transaction

#### 5. Error Handling
```typescript
try {
  const result = await db.runTransaction(async (transaction) => {
    // Transaction logic
    if (someCondition) {
      throw new Error('CUSTOM_ERROR')
    }
    return { success: true }
  })

  return result
} catch (error) {
  if (error instanceof Error && error.message === 'CUSTOM_ERROR') {
    // Handle custom error
    return { error: 'Custom error message' }
  }
  // Transaction failed due to conflicts or other issues
  throw error
}
```

#### 6. Query Constraints in Transactions
- Queries in transactions are **eventually consistent**
- For strongly consistent reads, use document references
- Limit queries to necessary documents only

### Common Use Cases

#### 1. Enforcing Limits (Favorites, Bookmarks)
```typescript
await db.runTransaction(async (transaction) => {
  const snapshot = await transaction.get(
    db.collection('favorites').where('userId', '==', uid)
  )

  if (snapshot.size >= LIMIT) {
    throw new Error('LIMIT_EXCEEDED')
  }

  transaction.set(favoriteRef, newFavorite)
})
```

#### 2. Atomic Counter Updates
```typescript
await db.runTransaction(async (transaction) => {
  const counterDoc = await transaction.get(counterRef)
  const currentCount = counterDoc.data()?.count ?? 0

  transaction.update(counterRef, { count: currentCount + 1 })
})
```

#### 3. Conditional Updates
```typescript
await db.runTransaction(async (transaction) => {
  const postDoc = await transaction.get(postRef)
  const post = postDoc.data()

  if (post.status !== 'published') {
    throw new Error('POST_NOT_PUBLISHED')
  }

  transaction.update(postRef, {
    views: (post.views ?? 0) + 1,
    lastViewedAt: Timestamp.now()
  })
})
```

### When NOT to Use Transactions

- **Simple single-document writes**: Use `set()` or `update()` directly
- **Batch writes without read dependencies**: Use `batch()` for better performance
- **Operations exceeding 500 documents**: Split into multiple transactions or batches
- **Long-running operations**: Move complex logic outside the transaction

### Batch vs. Transaction

| Feature | Transaction | Batch |
|---------|------------|-------|
| Reads | Yes, with locking | No |
| Atomicity | Yes | Yes |
| Retries | Automatic | Manual |
| Max operations | 500 | 500 |
| Use case | Read-then-write | Write-only |

**Use Batch when:**
```typescript
// ✅ Multiple independent writes
const batch = db.batch()
batch.set(ref1, data1)
batch.set(ref2, data2)
batch.delete(ref3)
await batch.commit()
```

### References

- [Firestore Transactions Documentation](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firestore Best Practices for Data Modeling](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore Query Limitations](https://firebase.google.com/docs/firestore/query-data/queries#query_limitations)
- [Collection Group Queries](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query)