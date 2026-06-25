import './columns.css';

// Server Component port of the native columns decorate(): adds columns-N-cols on the block
// and columns-img-col on any cell whose only content is a picture.
export default function Columns({ rows, variants = [] }) {
  const colCount = rows[0]?.length ?? 0;
  return (
    <div className={['columns', ...variants, 'block', `columns-${colCount}-cols`].join(' ')}>
      {rows.map((cells, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i}>
          {cells.map((cell, j) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={j}
              className={cell.pictureOnly ? 'columns-img-col' : undefined}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: cell.html }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
