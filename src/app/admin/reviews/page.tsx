import { db } from '@/lib/db/client'
import { AdminPage, Cell, DataTable, EmptyState, Row } from '@/components/admin/shell'
import { Badge } from '@/components/ui/badge'
import { ReviewModerationActions } from '@/components/admin/review-actions'

async function Reviews() {
  const reviews = await db.review.findMany({
    where: { moderationStatus: { in: ['PENDING', 'FLAGGED_COMPLIANCE'] } },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  })

  if (reviews.length === 0) {
    return <EmptyState title="Nothing awaiting moderation" hint="New reviews appear here before they publish." />
  }

  return (
    <DataTable headers={['Review', 'Product', 'Rating', 'Compliance', 'Action']}>
      {reviews.map((r) => {
        const flags = (r.complianceFlags as { term: string }[] | null) ?? []
        return (
          <Row key={r.id}>
            <Cell className="max-w-sm">
              <p className="text-foreground">{r.body}</p>
              <p className="mt-1 text-xs text-foreground-subtle">
                {r.authorName} · {r.createdAt.toISOString().slice(0, 10)}
              </p>
            </Cell>
            <Cell className="text-foreground-muted">{r.product.name}</Cell>
            <Cell className="tabular text-foreground">{r.rating}/5</Cell>
            <Cell>
              {flags.length > 0 ? (
                <Badge tone="danger">{flags.map((f) => f.term).join(', ')}</Badge>
              ) : (
                <Badge tone="success">clean</Badge>
              )}
            </Cell>
            <Cell>
              <ReviewModerationActions id={r.id} />
            </Cell>
          </Row>
        )
      })}
    </DataTable>
  )
}

export default function AdminReviewsPage() {
  return (
    <AdminPage
      title="Review moderation"
      description="Reviews publish only after a human approves them. A customer claiming a product cured something creates the same FDA exposure as an advertisement, so the lexicon flags them here."
    >
      <Reviews />
    </AdminPage>
  )
}
