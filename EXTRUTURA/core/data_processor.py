import pandas as pd
import core.formater as formater

from core.database import get_setting

def get_bank_info(bank):
    if bank == "JUPITER":
        default_jup = """
*DADOS BANCÁRIOS*

    *BCI:* 15466194210001 
    *NIB:* 0008.0000.54661942101.95

    *BIM:* 330788916 
    *NIB:* 0001.0000.00330788916.57

    *STB:* 1086059371008 
    *NIB:* 0003.0108.06059371008.08
    
    *NEDBANK:* 9244900 
    *NIB:* 0043.0000.00009244900.41

    *TITULAR - JUPITER LOGISTICS LDA*"""
        return get_setting("bank_info_jupiter", default_jup)
    else:
        default_fil = """
*DADOS BANCÁRIOS*

    *BCI:* 18909451710002 
    *NIB:* 0008.0000.89094517102.92

    *BIM:* 75470366 
    *NIB:* 0001.0000.00075470366.57
    
    *TITULAR - FILIPE CHITOFO*"""
        return get_setting("bank_info_filipe", default_fil)

def process_and_clean_data(raw_data, agent_data=None):
    if agent_data is None:
        agent_data = {}
    grouped_data = []
    current_entry_key = None
    skipped_rows = []
    for index, row in raw_data.iterrows():
        if pd.isna(row.get("ID CODE")) or pd.isna(row.get("CONSIGNEE")):
            skipped_rows.append(f"Linha {index + 2}: {row.to_dict()}")
            continue
        id_code = str(int(row["ID CODE"]) if isinstance(row["ID CODE"], (int, float)) else row["ID CODE"]).strip()
        consignee = str(row["CONSIGNEE"])
        
        no_val = row.get("NO", "")
        if pd.isna(no_val):
            no_str = ""
        elif isinstance(no_val, (int, float)):
            no_str = str(int(no_val))
        else:
            no_str = str(no_val).strip().replace(".0", "")
            
        entry_key = (no_str, id_code)
        is_new_entry = (current_entry_key != entry_key)
        
        def get_numeric_value(value):
            if pd.isna(value):
                return 0
            str_val = str(value)
            str_val = str_val.replace("[MZN]", "").replace("$", "").replace(",", "")
            try:
                return float(str_val)
            except ValueError:
                return 0
        row_data = {
            "STATUS": "PODE LEVANTAR" if get_numeric_value(row.get("DUTY PREPAID", 0)) > 0 else "",
            "NO": no_str if is_new_entry else "",
            "ID CODE": id_code if is_new_entry else "",
            "NAME": consignee if is_new_entry else "",
            "PHONE NUMBER": str(row.get("PHONE NUMBER", "")).replace(".0", "") if is_new_entry else "",
            "ORDER NUMBER": str(row.get("ORDER NUMBER", "")),
            "CARGO DESCRIPTION (PACKAGES)": str(row.get("ITEM NAME", "")),
            "CBM": get_numeric_value(row.get("CBM", 0)),
            "UNIT CBM DUTY": get_numeric_value(row.get("UNIT CBM DUTY", row.get("UNIT PRICE/CBM DUTY(MZN)", 0))),
            "DUTY PREPAID": get_numeric_value(row.get("DUTY PREPAID", 0)),
            "AMOUNT DUTY": get_numeric_value(row.get("AMOUNT DUTY", row.get("AMOUNT/MZN DUTY", 0))),
            "PAID": 0,
            "BALANCE": 0,
            "BANK IN DUTY": "",
            "CONFIRMATION": "CONFIRMADO" if get_numeric_value(row.get("DUTY PREPAID", 0)) > 0 else "",
            "PAG 1": "",
            "PAG 2": "",
            "PAG 3": "",
            "NOTA DUTY": "",
            "UNIT CBM FREIGHT": get_numeric_value(row.get("UNIT CBM FREIGHT", row.get("UNIT PRICE/CBM FREIGHT", 0))),
            "AMOUNT FREIGHT": get_numeric_value(row.get("AMOUNT FREIGHT", 0)),
            "PAID FREIGHT": get_numeric_value(row.get("RECEIVED FREIGHT", 0)),
            "BALANCE FREIGHT": get_numeric_value(row.get("AMOUNT FREIGHT", 0)) - get_numeric_value(row.get("RECEIVED FREIGHT", 0)),
            "BANK IN FREIGHT": "",
            "NOTA FREIGHT": "",
            "PACKAGES": int(get_numeric_value(row.get("PKGS", 0))) or 0,
            "AGENT": agent_data.get(id_code, str(row.get("AGENT", ""))),
        }
        grouped_data.append(row_data)
        current_entry_key = entry_key
        
    return pd.DataFrame(grouped_data), skipped_rows

def export_with_formatting(data, id_ctr):
    output_file = f"Lista_{id_ctr}.xlsx"
    data.to_excel(output_file, index=False, engine="openpyxl")
    formater.format_excel(output_file)
    return output_file
