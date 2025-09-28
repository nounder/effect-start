import { Route } from "effect-start"

export default Route
  .page(function*() {
    const txs: Stream.Stream<IDBTransaction> = yield* Ethereum
      .transactions
      .stream()

    return (
      <div>
        <h1>
          Recent transactions
        </h1>
        <table>
          <tr>
            <th>
              Hash
            </th>
            <th>
              From
            </th>
            <th>
              To
            </th>
          </tr>
          <For each={txs}>
            {(tx) => (
              <tr>
                <td>
                  {tx.hash}
                </td>
                <td>
                  {tx.from}
                </td>
                <td>
                  {tx.to}
                </td>
              </tr>
            )}
          </For>
        </table>
      </div>
    )
  })
