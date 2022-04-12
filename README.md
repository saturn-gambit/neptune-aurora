oauth2
====

`openssl genrsa 2048 -out private.pem`

`openssl rsa -in private.pem -pubout -outform PEM -out public.pem`

```
/**
 curl localhost:12000/api/v2/eg-resource \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlMzViMTY0YmNhYzI5MWExZmMyYjA0MjdmZmU1NzIzMmM4MjNmNTZkNzllMzQ5OTBiYTM0YjY2NWY2YTEzYzYyZmJhYjUxNTJlYmUwZDQyNmRlY2VjMGE3YzdkZjQxMWMiLCJleHAiOjE2NDg5MDY2OTYsImlhdCI6MTY0ODkwNjU5Nn0.tU0pHDt97ep-gBH0znZfXt2ieA7JGgjGDv9NbjbzKDhLB1XmXwUVAlykQSc75hYdy0Sxo2tDMt-Ik6iD97dx6gZW-pDo2AU3o30MzyKjI36ffSNDxaj-5Zp8C6Ek4FrvWBhbUScswFaBFFDQipAwk4ZhthNhfvqP-u_-xPD3Fvt4X3FvQoYAPIcL3LlEwW_F7zfFozMbCdq_8OZ7D7iPdQvUO7OE82CbR8LhhJovRYOnEGFboLP70DVQCEL_9yGbR5JzYmhzRYMFMjKwHOIdt7w9tPzJZmZIw25EijV2Gs8TKnElTNlRkrlXEL9ol7YsxqDidN4tCoIaLJmZQJd_Wg"
*/
```

```
async function test_heroku_api () {
  const r = await fetch(`https://neptune-aurora.herokuapp.com/api/v2/jwt`)
  const jwt = await r.text()
  const Authorization = `Bearer ${jwt}`
  const headers = { Authorization }
  const r1 = await fetch(`https://neptune-aurora.herokuapp.com/api/v2/eg-resource`, { headers })
  const j = await r1.json()
  console.log(j)
}
```

```
curl localhost:12000/api/v3/authenticate \
  -v \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "username": "braun", "password": "braun" }'
```

```
curl localhost:12000/api/v3/eg-resource \
  -v \
  --cookie "jwt=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjB4MDAwMCIsImV4cGlyZXMiOjE2NDk3NjQ1NTg3NTcsImlhdCI6MTY0OTc2NDIwOH0.UFk_zgzdclmzu78cdDVPA6oiX5D76aqZQk8Gtbrax7HD2e9KaJPnCn8iLk0fClPYLu3_gwqx3oaFikAou_tJwVOi0ugzCXg0R1dbHFGgOJkrmrCMBxP-Cmah-_ctMQxQ4CRB595NGPIy7iol-HuUQ8ovQXbApCzK_ewgTWZby9OU2EF9UfcHGHSYjSKh7CpwQgcpwy9xjbCCb_Lzo4RhZoZXrCtmcaG0cDkSjoamJJxgKrIJPPz6X5ixdOo81uqi-YKpeKmgccU1qlIbCVXBuhVFiSIUUuIiayyfb_XW0GvppexQsuEdXf-fM68sS7_8E5OCBak-9ADgzFkAyfSwkQ; Path=/; HttpOnly; Secure"
```