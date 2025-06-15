## How to use

### Obtain Openrouter's api key

1. Go to https://openrouter.ai and sign in.
2. On the top right corner with your profile picture, select the Keys section.
3. Press Create API Key.
4. Name it something e.g. Japanese Homework, and create it.
5. Copy the API key and ssave it.

### Using the key, there are 2 options, both require obtaining it first

1. Using .env file
   - Create a file named `.env` without the `.
   - Add the key to the file in the following format.
     `OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Save it, and done!
2. Placing it in main.py (not recommended)
   because if you're gonna share the code you might leak it and other people may use your api key.
   - paste it on line 7 inside the quotations.
