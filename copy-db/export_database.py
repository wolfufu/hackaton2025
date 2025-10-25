import os
import subprocess
from db_config import *

def create_backup(password: str):
    """
    :param password: пароль подключения к бд, такой же как указано в db_config.py
    """
    try:
        # Получаем параметры подключения
        conn = get_db_connection('conference_db', 'postgres', 'password', 'localhost', '5432')
        db_params = conn.get_dsn_parameters()
        conn.close()

        # Устанавливаем переменную окружения PGPASSWORD
        os.environ['PGPASSWORD'] = password

        # Путь к утилите pg_dump
        pg_dump_path = r"C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
        
        # Проверяем существует ли pg_dump
        if not os.path.exists(pg_dump_path):
            raise FileNotFoundError(f"pg_dump не найден по пути: {pg_dump_path}")

        # Создаем папку backup если не существует
        backup_dir = "backup"
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)

        # Параметры для резервного копирования
        username = db_params['user']
        host = db_params['host']
        port = db_params['port']
        database = db_params['dbname']
        backup_file = os.path.join(backup_dir, "backup.sql")

        # Команда для выполнения резервного копирования
        command = [
            pg_dump_path, 
            "-U", username, 
            "-h", host, 
            "-p", port, 
            "-F", "p", 
            "-f", backup_file, 
            database
        ]

        print(f"Выполняется команда: {' '.join(command)}")
        
        # Выполняем команду
        result = subprocess.run(command, check=True, text=True, capture_output=True)
        print("Успех", "Резервное копирование успешно завершено!")
        
    except FileNotFoundError as e:
        print(f"Ошибка: {e}")
        print("Убедитесь, что PostgreSQL установлен и путь к pg_dump правильный")
    
    except subprocess.CalledProcessError as e:
        print(f"Ошибка при создании бекапа: {e}")
        print(f"Stderr: {e.stderr}")
        print(f"Stdout: {e.stdout}")
    
    except Exception as e:
        print(f"Неожиданная ошибка: {e}")
    
    finally:
        # Очищаем пароль из переменных окружения для безопасности
        if 'PGPASSWORD' in os.environ:
            del os.environ['PGPASSWORD']

# Вызываем функцию
create_backup("password")