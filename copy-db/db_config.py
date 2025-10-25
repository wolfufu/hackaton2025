import psycopg2
import os, subprocess, datetime
from psycopg2 import sql


def get_db_connection(dbname:str, user:str, password:str, host:str, port:str):
    conn = psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )
    return conn


'''
пример данных:
    conn = psycopg2.connect(
        dbname="drug_store_new",
        user="postgres",
        password="password",
        host="localhost",
        port="5432"
    )
    return conn

'''