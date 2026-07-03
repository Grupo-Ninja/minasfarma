"""
Seed inicial das ESCALAS DE TRABALHO (a partir dos 6 PDFs de arquivos/).

- Cria (ou reutiliza) um login por funcionário, cargo 'operador'.
- Insere a escala rotativa de cada um (grade Domingo..Sábado por semana do ciclo).
- Define a data-âncora da Semana 1 como o Domingo da semana atual, se ainda não houver.

Rodar dentro do container do backend:
    docker exec farma_canaa_backend_prod python seed_schedules.py

Dados capturados dos PDFs. Weekday: 0=Domingo .. 6=Sábado.
Cada dia é uma lista de turnos "HH:MM-HH:MM" ou None (folga).
"""
from datetime import date, timedelta

import database, models
from crud import get_password_hash

TEMP_PASSWORD = "Escala@2026"  # senha temporária para logins criados agora

# W = trabalho (lista de turnos), None = folga
EMPLOYEES = {
    "ANA": {
        "login": "ana", "num_weeks": 4,
        "weeks": [
            # Semana 1
            [["07:00-08:00", "08:30-15:00"], ["14:00-17:00", "17:30-22:00"], ["14:00-17:00", "17:30-22:00"],
             ["14:00-17:00", "17:30-22:00"], None, ["14:00-17:00", "17:30-22:00"], None],
            # Semana 2
            [None, None, ["14:00-17:00", "17:30-22:00"], ["14:00-17:00", "17:30-22:00"], ["14:00-17:00", "17:30-22:00"],
             ["14:00-17:00", "17:30-22:00"], ["07:00-08:00", "08:30-11:00", "13:00-16:00", "16:30-22:00"]],
            # Semana 3
            [["07:00-08:00", "08:30-15:00"], ["14:00-17:00", "17:30-22:00"], None, ["14:00-17:00", "17:30-22:00"],
             ["14:00-17:00", "17:30-22:00"], ["14:00-17:00", "17:30-22:00"], None],
            # Semana 4
            [None, ["14:00-17:00", "17:30-22:00"], ["14:00-17:00", "17:30-22:00"], None, ["14:00-17:00", "17:30-22:00"],
             ["14:00-17:00", "17:30-22:00"], ["07:00-08:00", "08:30-11:00", "13:00-16:00", "16:30-22:00"]],
        ],
    },
    "DIEGO": {
        "login": "diego", "num_weeks": 2,
        "weeks": [
            [["07:30-08:00", "08:30-15:00"], ["15:00-16:00", "16:30-22:00"], ["15:00-16:00", "16:30-22:00"],
             ["15:00-16:00", "16:30-22:00"], ["15:00-16:00", "16:30-22:00"], ["15:00-16:00", "16:30-22:00"],
             ["07:30-12:00", "14:00-21:00"]],
            [None, ["15:00-16:00", "16:30-22:00"], ["15:00-16:00", "16:30-22:00"], ["15:00-16:00", "16:30-22:00"],
             ["15:00-16:00", "16:30-22:00"], ["15:00-16:00", "16:30-22:00"], None],
        ],
    },
    "JORDANA": {
        "login": "jordana", "num_weeks": 4,
        "weeks": [
            [None, None, ["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-15:00"],
             ["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-11:00", "13:00-16:00", "16:30-22:00"]],
            [["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-15:00"], None, ["07:00-08:00", "08:30-15:00"],
             ["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-15:00"], None],
            [None, ["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-15:00"], None, ["07:00-08:00", "08:30-15:00"],
             ["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-11:00", "13:00-16:00", "16:30-22:00"]],
            [["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-15:00"],
             ["07:00-08:00", "08:30-15:00"], None, ["07:00-08:00", "08:30-15:00"], None],
        ],
    },
    "MARILSON": {
        "login": "marilson", "num_weeks": 2,
        "weeks": [
            [["07:30-08:30", "09:00-15:00"], ["07:30-08:30", "09:00-15:00"], ["07:30-08:30", "09:00-15:00"],
             ["07:30-08:30", "09:00-15:00"], ["07:30-08:30", "09:00-15:00"], ["07:30-08:30", "09:00-15:00"],
             ["07:30-08:30", "09:00-12:00", "14:00-19:00"]],
            [None, ["07:30-08:30", "09:00-15:24"], ["07:30-08:30", "09:00-15:24"], ["07:30-08:30", "09:00-15:24"],
             ["07:30-08:30", "09:00-15:24"], ["07:30-08:30", "09:00-15:24"], None],
        ],
    },
    "SEBASTIAO": {
        "login": "sebastiao", "nome": "SEBASTIÃO", "num_weeks": 4,
        "weeks": [
            [None, ["07:00-08:00", "08:30-15:00"], None, ["07:00-08:00", "08:30-15:00"], ["14:00-16:00", "16:30-22:00"],
             ["14:00-16:00", "16:30-22:00"], ["07:00-08:00", "08:30-11:00", "13:00-16:00", "16:30-22:00"]],
            [["14:00-16:00", "16:30-22:00"], ["14:00-16:00", "16:30-22:00"], ["07:00-08:00", "08:30-15:00"], None,
             ["07:00-08:00", "08:30-15:00"], ["14:00-16:00", "16:30-22:00"], None],
            [None, ["07:00-08:00", "08:30-15:00"], ["14:00-16:00", "16:30-22:00"], ["07:00-08:00", "08:30-15:00"], None,
             ["14:00-16:00", "16:30-22:00"], ["07:00-08:00", "08:30-11:00", "13:00-16:00", "16:30-22:00"]],
            [["14:00-16:00", "16:30-22:00"], None, ["07:00-08:00", "08:30-15:00"], ["14:00-16:00", "16:30-22:00"],
             ["07:00-08:00", "08:30-15:00"], ["14:00-16:00", "16:30-22:00"], None],
        ],
    },
    "TAIS": {
        "login": "TAIS", "nome": "TAÍS", "num_weeks": 4,
        "weeks": [
            [["07:00-08:00", "08:30-15:00"], None, ["07:00-08:00", "08:30-16:20"], ["07:00-08:00", "08:30-16:20"],
             ["07:00-08:00", "08:30-16:20"], ["07:00-08:00", "08:30-16:20"], None],
            [None, ["07:00-08:00", "08:30-16:20"], ["07:00-08:00", "08:30-16:20"], ["07:00-08:00", "08:30-16:20"],
             ["07:00-08:00", "08:30-16:20"], None, ["13:00-16:00", "16:30-22:00"]],
            [["07:00-08:00", "08:30-15:00"], ["07:00-08:00", "08:30-16:20"], ["07:00-08:00", "08:30-16:20"],
             ["07:00-08:00", "08:30-16:20"], None, ["07:00-08:00", "08:30-16:20"], None],
            [None, ["07:00-08:00", "08:30-16:20"], ["07:00-08:00", "08:30-16:20"], None, ["07:00-08:00", "08:30-16:20"],
             ["07:00-08:00", "08:30-16:20"], ["13:00-16:00", "16:30-22:00"]],
        ],
    },
}


def parse_shifts(turnos):
    if not turnos:
        return False, []
    shifts = []
    for t in turnos:
        ent, sai = t.split("-")
        shifts.append({"entrada": ent, "saida": sai})
    return True, shifts


def get_or_create_user(db, key, cfg):
    login = cfg["login"]
    nome = cfg.get("nome", key.capitalize())
    # match case-insensitive
    user = db.query(models.User).filter(models.User.login.ilike(login)).first()
    if user:
        return user, False
    user = models.User(login=login, nome=nome, senha=get_password_hash(TEMP_PASSWORD), cargo="operador", active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user, True


def main():
    db = database.SessionLocal()
    created_logins = []
    try:
        for key, cfg in EMPLOYEES.items():
            user, created = get_or_create_user(db, key, cfg)
            if created:
                created_logins.append(user.login)

            # remove escala anterior
            existing = db.query(models.EmployeeSchedule).filter(
                models.EmployeeSchedule.user_id == user.id).first()
            if existing:
                db.delete(existing)
                db.flush()

            sch = models.EmployeeSchedule(user_id=user.id, num_weeks=cfg["num_weeks"],
                                          source_filename=f"ESCALA DE TRABALHO - {key}.pdf")
            db.add(sch)
            db.flush()
            for wi, week in enumerate(cfg["weeks"], start=1):
                for wd in range(7):
                    is_work, shifts = parse_shifts(week[wd])
                    db.add(models.ScheduleDay(schedule_id=sch.id, week_index=wi, weekday=wd,
                                              is_work=is_work, shifts=shifts))
            db.commit()
            print(f"OK  {key:10s} -> user_id={user.id} login={user.login} ({cfg['num_weeks']} semanas)")

        # âncora: Domingo da semana atual, se ainda não definida
        anchor_row = db.query(models.AppSetting).filter(models.AppSetting.key == "schedule_anchor_date").first()
        if not anchor_row or not anchor_row.value:
            today = date.today()
            sunday = today - timedelta(days=(today.weekday() + 1) % 7)
            if anchor_row:
                anchor_row.value = sunday.isoformat()
            else:
                db.add(models.AppSetting(key="schedule_anchor_date", value=sunday.isoformat()))
            db.commit()
            print(f"\nAncora da Semana 1 definida em {sunday.isoformat()} (domingo desta semana).")
        else:
            print(f"\nAncora ja existente: {anchor_row.value}")

        if created_logins:
            print(f"\nLogins criados (senha temporaria '{TEMP_PASSWORD}'): {', '.join(created_logins)}")
        print("\nSeed concluido com sucesso.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
