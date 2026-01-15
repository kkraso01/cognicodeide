#!/usr/bin/env python
import os
import sys

# Set environment variable before importing
os.environ['OLLAMA_BASE_URL'] = 'https://chatucy.cs.ucy.ac.cy/ollama/v1'

import instructor

print(f'OLLAMA_BASE_URL env: {os.getenv("OLLAMA_BASE_URL")}')

try:
    client = instructor.from_provider(
        'ollama/mistral',
        mode=instructor.Mode.JSON,
        async_client=True,
        client_kwargs={'verify': False}
    )
    print(f'Client created successfully')
    print(f'Client base_url: {client.base_url}')
    print(f'Client api_key: {client.api_key}')
except Exception as e:
    print(f'Error: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
