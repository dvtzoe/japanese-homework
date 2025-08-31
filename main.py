from playwright.sync_api import Locator, Page, sync_playwright, expect
from dotenv import load_dotenv
import os
import json
from openai import OpenAI

OPENROUTER_API_KEY = ""

NAME = "Natpakan Tabudda"  # Name
ID = "67991039"  # id
EMAIL = "67991039@kmitl.ac.th"  # email
CLASS = 3  # Index your class appears at in the choices. e.g. M1 -> 0, M2 -> 1, C1 -> 2 ... E2 -> 5

NEXT_BUTTON_LABEL = ["Next", "ถัดไป"]
SUBMIT_BUTTON_LABEL = ["Submit", "ส่ง"]
VIEW_SCORE_LABEL = ["View score", "ดูคะแนน"]
USER_DATA_DIR = "data"


def prompt_llm(messages, response_format):
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.getenv("OPENROUTER_API_KEY") or OPENROUTER_API_KEY,
    )

    completion = client.chat.completions.create(
        model="google/gemini-2.5-flash",
        messages=messages,
        response_format=response_format,
    )

    print(completion.choices[0].message.content)

    if not completion.choices[0].message.content:
        return

    return json.loads(completion.choices[0].message.content)["answer"]


def solve_page(page: Page):
    global settings
    question_blocks = page.locator('div[role="listitem"]').all()

    for block in question_blocks:
        page.wait_for_load_state("networkidle")
        question_text = ""
        image_src = ""
        try:
            question_text_locator: Locator = block.locator('div[role="heading"]')
            print(question_text_locator.all_inner_texts())
            if question_text_locator.count() > 0:
                question_text = question_text_locator.all_inner_texts()[0].split("\n")[
                    0
                ]

            image_locator: Locator = block.locator("img")
            if image_locator.count() > 0:
                image_src = image_locator.get_attribute("src")

            text_input_locator: Locator = block.locator('input[type="text"]')
            radio_locator: Locator = block.locator('div[role="radio"]')
            dropdown_locator: Locator = block.locator("div[data-value]")

            if "mail" in question_text.lower() and question_text != "Email *":
                block.locator('input[type="email"]').fill(os.getenv("EMAIL") or EMAIL)
                continue
            if "class" in question_text.lower():
                index = os.getenv("CLASS")
                radio_locator.nth(int(index) if index is not None else CLASS).click()
                continue
            if "id" in question_text.lower():
                text_input_locator.fill(os.getenv("ID") or ID)
                continue
            if "name" in question_text.lower() or "名" in question_text:
                text_input_locator.fill(os.getenv("NAME") or NAME)
                continue

            if text_input_locator.count() > 0:
                answer = prompt_llm(
                    [
                        {
                            "role": "user",
                            "content": list(
                                filter(
                                    lambda i: i is not None,
                                    [
                                        {
                                            "type": "text",
                                            "text": f"answer the question: {question_text}",
                                        },
                                        (
                                            {
                                                "type": "image_url",
                                                "image_url": {"url": image_src},
                                            }
                                            if image_src
                                            else None
                                        ),
                                    ],
                                ),
                            ),
                        }
                    ],
                    {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "answer",
                            "strict": True,
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "answer": {
                                        "type": "string",
                                        "description": "The answer to the following question",
                                    }
                                },
                                "required": ["answer"],
                                "additionalProperties": False,
                            },
                        },
                    },
                )

            elif radio_locator.count() > 0:
                choices = []
                for i in radio_locator.all():
                    choices.append(i.locator("xpath=../..").text_content())
                answer = prompt_llm(
                    [
                        {
                            "role": "user",
                            "content": list(
                                filter(
                                    lambda i: i is not None,
                                    [
                                        {
                                            "type": "text",
                                            "text": f"answer the question by the choice number: {question_text}\n{[f'{i}. {v}' for i, v in enumerate(choices)]}",
                                        },
                                        (
                                            {
                                                "type": "image_url",
                                                "image_url": {"url": image_src},
                                            }
                                            if image_src
                                            else None
                                        ),
                                    ],
                                ),
                            ),
                        }
                    ],
                    {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "answer",
                            "strict": True,
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "answer": {
                                        "type": "number",
                                        "description": "The choice number of the answer to the following question",
                                    }
                                },
                                "required": ["answer"],
                                "additionalProperties": False,
                            },
                        },
                    },
                )
                if isinstance(answer, int):
                    radio_locator.nth(answer).click()
            elif dropdown_locator.count() > 0:
                choices = []
                for i in dropdown_locator.all():
                    choices.append(i.inner_text())
                answer = prompt_llm(
                    [
                        {
                            "role": "user",
                            "content": list(
                                filter(
                                    lambda i: i is not None,
                                    [
                                        {
                                            "type": "text",
                                            "text": f"answer the question by the choice number: {question_text}\n{[f'{i}. {v}' for i, v in enumerate(choices)]}",
                                        },
                                        (
                                            {
                                                "type": "image_url",
                                                "image_url": {"url": image_src},
                                            }
                                            if image_src
                                            else None
                                        ),
                                    ],
                                ),
                            ),
                        }
                    ],
                    {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "answer",
                            "strict": True,
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "answer": {
                                        "type": "number",
                                        "description": "The choice number of the answer to the following question",
                                    }
                                },
                                "required": ["answer"],
                                "additionalProperties": False,
                            },
                        },
                    },
                )
                if isinstance(answer, int):
                    dropdown_locator.nth(0).click()

                    answer_locator = block.locator('div[role="option"]').nth(answer)
                    expect(answer_locator).to_be_visible()
                    expect(answer_locator).to_be_enabled()
                    answer_locator.click(force=True)

        except Exception as e:
            print(e)

    button_locator = page.locator('div[role="button"]').all()

    for i in button_locator:
        if i.inner_text() in NEXT_BUTTON_LABEL:
            input("Press <Enter> to continue")
            i.click()
            page.wait_for_load_state("networkidle")
            solve_page(page)
            break
        elif i.inner_text() in SUBMIT_BUTTON_LABEL:
            input("Press <Enter> to continue")
            i.click()
            page.wait_for_load_state("networkidle")
            solve_page(page)
            break
    else:
        if page.locator('a[rel="noopener"]').count() > 0:
            page.locator('a[rel="noopener"]').click()
            input("Press <Enter> to continue")
            return


def main():
    load_dotenv()

    form_url = (
        input("gib form url: ")
        or "https://docs.google.com/forms/d/e/1FAIpQLSfa548JMCp-JSEoYEsmk9DDE-FIj9oYyQr-6Bbof8XdQ__jhQ/formResponse?pli=1"
    )

    print(f"Loading form from: {form_url}")
    with sync_playwright() as p:
        first_time = not os.path.exists(USER_DATA_DIR)
        browser = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = browser.new_page()
        page.goto(form_url, wait_until="domcontentloaded")
        if first_time:
            input("Press <Enter> to continue")
            browser.close()
            return
        solve_page(page)
        browser.close()


if __name__ == "__main__":
    main()
