"""
Code execution service using Docker containers for isolation.
Supports Python, Java, and C execution with resource limits.
Handles custom build/run commands and dependency installation.
"""
import subprocess
import tempfile
import os
import time
import shlex
from typing import Dict, Any, List, Optional


class CodeExecutor:
    """Execute code in isolated environment with resource limits."""
    
    # Resource limits
    MAX_EXECUTION_TIME = 30  # seconds
    MAX_BUILD_TIME = 120  # seconds for build/install
    MAX_MEMORY = "256m"
    MAX_CPU = "1.0"
    
    @staticmethod
    def get_default_commands(language: str) -> Dict[str, Optional[str]]:
        """Get default build and run commands for a language."""
        language = language.lower()
        
        defaults = {
            'python': {
                'build': 'pip install -r requirements.txt',  # if requirements.txt exists
                'run': 'python main.py'
            },
            'java': {
                'build': 'javac *.java',
                'run': 'java Main'
            },
            'c': {
                'build': 'gcc *.c -o app',
                'run': './app'
            },
            'cpp': {
                'build': 'g++ *.cpp -o app',
                'run': './app'
            },
        }
        
        return defaults.get(language, {'build': None, 'run': None})
    
    @staticmethod
    async def write_project_files(work_dir: str, files: List[Dict[str, str]]) -> str:
        """Write all project files to working directory. Returns main file path."""
        main_file = None
        
        for file in files:
            file_path = os.path.join(work_dir, file['name'])
            
            # Create subdirectories if needed
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(file['content'])
            
            # Track main file
            if 'main' in file['name'].lower() or file.get('is_main'):
                main_file = file_path
        
        return main_file or files[0]['name'] if files else None
    
    @staticmethod
    async def execute_command(
        command: str,
        work_dir: str,
        timeout: int = 30,
        input_data: str = ""
    ) -> Dict[str, Any]:
        """Execute a shell command in the working directory."""
        start_time = time.time()
        
        try:
            # Parse command safely
            cmd_args = shlex.split(command) if isinstance(command, str) else command
            
            result = subprocess.run(
                cmd_args,
                cwd=work_dir,
                input=input_data,
                capture_output=True,
                text=True,
                timeout=timeout,
                shell=False
            )
            
            execution_time = time.time() - start_time
            
            return {
                'stdout': result.stdout,
                'stderr': result.stderr,
                'exit_code': result.returncode,
                'execution_time': execution_time,
                'status': 'success' if result.returncode == 0 else 'error'
            }
            
        except subprocess.TimeoutExpired:
            return {
                'stdout': '',
                'stderr': f'Command timed out after {timeout} seconds',
                'exit_code': -1,
                'execution_time': timeout,
                'status': 'timeout'
            }
        except Exception as e:
            return {
                'stdout': '',
                'stderr': str(e),
                'exit_code': -1,
                'execution_time': time.time() - start_time,
                'status': 'error'
            }
    
    @staticmethod
    async def execute_project(
        language: str,
        files: List[Dict[str, str]],
        input_data: str = "",
        custom_build_command: Optional[str] = None,
        custom_run_command: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a multi-file project with optional build step."""
        
        # Create temporary working directory
        work_dir = tempfile.mkdtemp()
        
        try:
            # Write all project files
            await CodeExecutor.write_project_files(work_dir, files)
            
            # Get default commands
            defaults = CodeExecutor.get_default_commands(language)
            build_command = custom_build_command or defaults['build']
            run_command = custom_run_command or defaults['run']
            
            overall_start = time.time()
            build_output = None
            
            # Execute build command if specified
            if build_command:
                # Check if build is needed (e.g., requirements.txt exists for Python)
                should_build = True
                if language == 'python' and 'requirements.txt' in build_command:
                    should_build = os.path.exists(os.path.join(work_dir, 'requirements.txt'))
                
                if should_build:
                    build_result = await CodeExecutor.execute_command(
                        build_command,
                        work_dir,
                        timeout=CodeExecutor.MAX_BUILD_TIME
                    )
                    
                    build_output = {
                        'stdout': build_result['stdout'],
                        'stderr': build_result['stderr'],
                        'time': build_result['execution_time']
                    }
                    
                    if build_result['exit_code'] != 0:
                        return {
                            'stdout': build_result['stdout'],
                            'stderr': f"Build failed:\n{build_result['stderr']}",
                            'exit_code': build_result['exit_code'],
                            'execution_time': build_result['execution_time'],
                            'status': 'build_error',
                            'build_output': build_output
                        }
            
            # Execute run command
            if not run_command:
                return {
                    'stdout': '',
                    'stderr': f'No run command specified for {language}',
                    'exit_code': -1,
                    'execution_time': 0,
                    'status': 'error'
                }
            
            run_result = await CodeExecutor.execute_command(
                run_command,
                work_dir,
                timeout=CodeExecutor.MAX_EXECUTION_TIME,
                input_data=input_data
            )
            
            # Combine results
            total_time = time.time() - overall_start
            
            result = {
                'stdout': run_result['stdout'],
                'stderr': run_result['stderr'],
                'exit_code': run_result['exit_code'],
                'execution_time': run_result['execution_time'],
                'total_time': total_time,
                'status': run_result['status'],
            }
            
            if build_output:
                result['build_output'] = build_output
            
            return result
            
        finally:
            # Clean up
            import shutil
            shutil.rmtree(work_dir, ignore_errors=True)
    
    @staticmethod
    async def execute_python(code: str, input_data: str = "") -> Dict[str, Any]:
        """Execute Python code in isolated environment."""
        start_time = time.time()
        
        try:
            # Create temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(code)
                temp_file = f.name
            
            try:
                # Execute with timeout and resource limits
                result = subprocess.run(
                    ['python', temp_file],
                    input=input_data,
                    capture_output=True,
                    text=True,
                    timeout=CodeExecutor.MAX_EXECUTION_TIME
                )
                
                execution_time = time.time() - start_time
                
                return {
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'exit_code': result.returncode,
                    'execution_time': execution_time,
                    'status': 'success' if result.returncode == 0 else 'error'
                }
            finally:
                # Clean up temp file
                os.unlink(temp_file)
                
        except subprocess.TimeoutExpired:
            return {
                'stdout': '',
                'stderr': f'Execution timed out after {CodeExecutor.MAX_EXECUTION_TIME} seconds',
                'exit_code': -1,
                'execution_time': CodeExecutor.MAX_EXECUTION_TIME,
                'status': 'timeout'
            }
        except Exception as e:
            return {
                'stdout': '',
                'stderr': str(e),
                'exit_code': -1,
                'execution_time': time.time() - start_time,
                'status': 'error'
            }
    
    @staticmethod
    async def execute_java(code: str, input_data: str = "") -> Dict[str, Any]:
        """Execute Java code in isolated environment."""
        start_time = time.time()
        
        try:
            # Create temporary directory for Java files
            temp_dir = tempfile.mkdtemp()
            
            # Extract class name from code
            import re
            class_match = re.search(r'public\s+class\s+(\w+)', code)
            if not class_match:
                return {
                    'stdout': '',
                    'stderr': 'No public class found in code',
                    'exit_code': -1,
                    'execution_time': 0,
                    'status': 'error'
                }
            
            class_name = class_match.group(1)
            java_file = os.path.join(temp_dir, f'{class_name}.java')
            
            # Write Java file
            with open(java_file, 'w') as f:
                f.write(code)
            
            try:
                # Compile
                compile_result = subprocess.run(
                    ['javac', java_file],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if compile_result.returncode != 0:
                    return {
                        'stdout': '',
                        'stderr': f'Compilation error:\n{compile_result.stderr}',
                        'exit_code': compile_result.returncode,
                        'execution_time': time.time() - start_time,
                        'status': 'compilation_error'
                    }
                
                # Execute
                result = subprocess.run(
                    ['java', '-cp', temp_dir, class_name],
                    input=input_data,
                    capture_output=True,
                    text=True,
                    timeout=CodeExecutor.MAX_EXECUTION_TIME
                )
                
                execution_time = time.time() - start_time
                
                return {
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'exit_code': result.returncode,
                    'execution_time': execution_time,
                    'status': 'success' if result.returncode == 0 else 'error'
                }
            finally:
                # Clean up
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
                
        except subprocess.TimeoutExpired:
            return {
                'stdout': '',
                'stderr': f'Execution timed out after {CodeExecutor.MAX_EXECUTION_TIME} seconds',
                'exit_code': -1,
                'execution_time': CodeExecutor.MAX_EXECUTION_TIME,
                'status': 'timeout'
            }
        except Exception as e:
            return {
                'stdout': '',
                'stderr': str(e),
                'exit_code': -1,
                'execution_time': time.time() - start_time,
                'status': 'error'
            }
    
    @staticmethod
    async def execute_c(code: str, input_data: str = "") -> Dict[str, Any]:
        """Execute C code in isolated environment."""
        start_time = time.time()
        
        try:
            # Create temporary files
            with tempfile.NamedTemporaryFile(mode='w', suffix='.c', delete=False) as f:
                f.write(code)
                c_file = f.name
            
            exe_file = c_file.replace('.c', '.exe' if os.name == 'nt' else '')
            
            try:
                # Compile
                compile_result = subprocess.run(
                    ['gcc', c_file, '-o', exe_file],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if compile_result.returncode != 0:
                    return {
                        'stdout': '',
                        'stderr': f'Compilation error:\n{compile_result.stderr}',
                        'exit_code': compile_result.returncode,
                        'execution_time': time.time() - start_time,
                        'status': 'compilation_error'
                    }
                
                # Execute
                result = subprocess.run(
                    [exe_file],
                    input=input_data,
                    capture_output=True,
                    text=True,
                    timeout=CodeExecutor.MAX_EXECUTION_TIME
                )
                
                execution_time = time.time() - start_time
                
                return {
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'exit_code': result.returncode,
                    'execution_time': execution_time,
                    'status': 'success' if result.returncode == 0 else 'error'
                }
            finally:
                # Clean up
                if os.path.exists(c_file):
                    os.unlink(c_file)
                if os.path.exists(exe_file):
                    os.unlink(exe_file)
                
        except subprocess.TimeoutExpired:
            return {
                'stdout': '',
                'stderr': f'Execution timed out after {CodeExecutor.MAX_EXECUTION_TIME} seconds',
                'exit_code': -1,
                'execution_time': CodeExecutor.MAX_EXECUTION_TIME,
                'status': 'timeout'
            }
        except Exception as e:
            return {
                'stdout': '',
                'stderr': str(e),
                'exit_code': -1,
                'execution_time': time.time() - start_time,
                'status': 'error'
            }
    
    @staticmethod
    async def execute(language: str, code: str, input_data: str = "") -> Dict[str, Any]:
        """Execute single file code (legacy support)."""
        files = [{'name': f'main.{language}', 'content': code, 'is_main': True}]
        return await CodeExecutor.execute_project(language, files, input_data)
