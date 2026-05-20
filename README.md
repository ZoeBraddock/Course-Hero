TIM WAS HERE 

## Testing locally

Follow the supabase docs, install and run supabase locally to make sure your mirations are validate before you push

## Precommit Hooks

When you commit, the precommit hooks will run and lint your code.

After cloning, run

```
sudo apt install -y pipx
pipx ensurepath
```

restart your shell then run

```
pipx install pre-commit
pre-commit --version
```

## Linting

You can also manually lint

### Squawk

Squawk makes sure we don't do any very very silly migrations

To install `npm install -g squawk-cli`
To run `squawk migrations/*.sql`

### SQLFluff

SQLFluff makes sure we have correct postgres syntax 

To install `pipx install sqlfluff`
To run `sqlfluff lint .`