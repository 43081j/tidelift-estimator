# tidelift-estimator 🌊

Estimates the potential [Tidelift](https://tidelift.com/) income for a given
npm package maintainer.

## How it works

1. Fetches all packages for the given username from the npm registry
2. Checks each package against the Tidelift API to see if it is "lifted"
   (i.e. subscribed to by Tidelift customers)
3. Estimates monthly income assuming **$50/month per lifted package**, with the
   user as the primary maintainer/beneficiary

> [!NOTE]
> This is a rough estimate. We have observed packages with 10k downloads and
> 10M downloads both earning $50/month. So we are assuming this flat rate
> is probably true for most lifted packages. We could of course be wrong.

## Usage

```sh
npx tidelift-estimator <username>
```

For example:

```sh
npx tidelift-estimator 43081j
```

Output:

```
Fetching packages for 43081j...

Tidelift Estimate for 43081j
──────────────────────────────
  Packages:        60
  Lifted packages: 5
  Monthly income:  $250
```

> [!NOTE]
> As you can see in this example (of myself), the number is off in this case.
> This is because I am not the primary maintainer/beneficiary of 4 of the
> lifted packages I am a publisher of. I actually earn $50/month from one,
> and a person I maintain a few packages with earns the other $200/month.

## License

[MIT](./LICENSE)
