from db_config import *

# функция чтобы загружать всю базу данных себе из sql файла бекапа
def restore_backup(backup_file:str, new_db_name:str, password:str):
    """
    Восстанавливает базу данных из backup файла в новую базу данных
    
    : backup_file: Путь к файлу бекапа
    : new_db_name: Имя новой базы данных
    : password: пароль подключения к бд, такой же как указано в db_config.py
    """
    # Получаем параметры подключения из функции get_db_connection
    conn = get_db_connection("postgres", "postgres", password, "localhost", "5432") # из db_config.py
    db_params = conn.get_dsn_parameters()
    conn.close()

    # Устанавливаем переменную окружения PGPASSWORD
    os.environ['PGPASSWORD'] = password

    # Путь к утилите psql
    psql_path = r"C:\Program Files\PostgreSQL\17\bin\psql.exe"
    
    # Параметры подключения
    username = db_params['user']
    host = db_params['host']
    port = db_params['port']

    try:
        # Сначала создаем новую базу данных
        conn = psycopg2.connect(
            dbname="postgres",  # Подключаемся к системной БД
            user=username,
            password=password,
            host=host,
            port=port
        )
        conn.autocommit = True  # Необходимо для создания БД
        cursor = conn.cursor()
        
        # Проверяем, существует ли уже база данных
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (new_db_name,))
        if cursor.fetchone():
            cursor.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(new_db_name)))
        
        cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(new_db_name)))
        cursor.close()
        conn.close()

        # Теперь восстанавливаем данные из бекапа в новую БД
        command = [
            psql_path,
            "-U", username,
            "-h", host,
            "-p", port,
            "-d", new_db_name,
            "-f", backup_file
        ]

        result = subprocess.run(command, check=True, text=True, capture_output=True)
        print("Успех", f"База данных {new_db_name} успешно восстановлена из бекапа!")
        return True
    except subprocess.CalledProcessError as e:
        print("Ошибка", f"Ошибка при восстановлении бекапа: {e}")
        return False
    except psycopg2.Error as e:
        print("Ошибка", f"Ошибка при работе с базой данных: {e}")
        return False

'''
    ПРИМЕР ВЫЗОВА:
    restore_backup("drug_store_backup_2025-03-26_18-07-12.sql", "drug_store_new", "password")
'''
restore_backup("backup\\backup.sql", "app", "12345") 