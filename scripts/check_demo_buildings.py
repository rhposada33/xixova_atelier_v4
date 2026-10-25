from xixova.demo_buildings import validate_demo_buildings


if __name__ == "__main__":
    registry = validate_demo_buildings()
    print(f"Edificios validados: {', '.join(item['id'] for item in registry['buildings'])}")
