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
  -d '{ "username": "0x0000", "password": "0x0000" }'
```

```
curl localhost:12000/api/v3/eg-resource \
  -v \
  --cookie "jwt=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjB4MDAwMCIsImV4cGlyZXMiOjE2NDk2ODEyNjE0NjIsImlhdCI6MTY0OTY4MDkxMX0.oSnoKaq5GWutigVtGo50x0WQee3LaRE9vCAgLMHVk7Tuv2omjZQBDQ66ZoaUAwvCFQhON4_nc1DTir1TOvBJbQKpvLDLfn7_8KNidX7mwroPtfv0r50cJMQlKWlWDSD0ca2hFZCcNhRYIBx7EpvmVj-4dCQLRVOM6eefL630Roox1W4pAno0tSzFEkIbq_7tF4V2xkiyIwZRBz1g5w9QvCJQHzNkuUne28FpI3mqQtY1NFacT6C7lGKAMH6GSeF2cQWSqhzAEtXOXzRUcLfhIFQPaBFNBJhJdwDuAWrjiZpuoFQy7-njdhpH3vtkNXrwOudLjJgAbV41-JhhyylG0Q; Path=/; HttpOnly; Secure"
```