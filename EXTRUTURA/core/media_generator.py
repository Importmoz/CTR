def generate_html_table(orders, container_number, bank_info=None):
    total_cbm = sum(o.get('CBM', 0) for o in orders)
    total_amount = sum(o.get('TOTAL_AMOUNT', 0) for o in orders)
    total_packages = sum(o.get('PACKAGES', 0) for o in orders)

    bank_html = ""
    if bank_info:
        bank_lines = [l.strip() for l in bank_info.split('\n') if l.strip()]
        bank_items = []
        is_first_bank = True
        for line in bank_lines:
            if ':*' in line:
                key = line.lstrip('*').split(':*')[0].strip()
                val = line.split(':*', 1)[1].strip().rstrip('*')
                if key != "NIB" and not is_first_bank:
                    bank_items.append("<tr class='bank-separator'><td colspan='2'></td></tr>")
                bank_items.append(f"<tr><td class='bank-key'>{key}</td><td class='bank-val'>{val}</td></tr>")
                if key != "NIB":
                    is_first_bank = False
            elif line.startswith('*') and line.endswith('*') and len(line) > 2:
                title = line.strip('*').strip()
                if title == "DADOS BANCÁRIOS":
                    continue
                bank_items.append(f"<tr><td colspan='2' class='bank-title'>{title}</td></tr>")
        bank_html = f"""
    <div class="bank-container">
        <table class="bank-table">
            <thead><tr><th colspan="2">DADOS BANCÁRIOS</th></tr></thead>
            <tbody>
                {"".join(bank_items)}
            </tbody>
        </table>
    </div>"""

    table_html = f"""
    <style>
        body {{ font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; background-color: #f9f9f9; }}
        .table-container {{ overflow-x: auto; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); background-color: white; }}
        table {{ border-collapse: collapse; width: 100%; min-width: 600px; }}
        th {{ background-color: #2c3e50; color: white; font-weight: 600; padding: 12px 15px; text-align: left; }}
        td {{ padding: 10px 15px; border: 1px solid #ddd; }}
        tr:nth-child(even) {{ background-color: #f8f9fa; }}
        .highlight {{ font-weight: bold; color: #e74c3c; }}
        .text-right {{ text-align: right; }}
        .text-center {{ text-align: center; }}
        .total-row {{ font-weight: bold; background-color: #e8f4f8 !important; }}
        .container-header {{ background-color: rgba(52, 73, 94, 0.8); color: white; font-weight: bold; text-align: center; font-size: 18px; padding: 10px; }}
        .v-align-middle {{ vertical-align: middle; }}
        .bank-container {{ margin-top: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); background-color: white; }}
        .bank-table th {{ background-color: #2c3e50; color: white; font-weight: 600; padding: 12px 15px; text-align: center; font-size: 16px; }}
        .bank-key {{ font-weight: 600; width: 40%; background-color: #f0f4f8; }}
        .bank-val {{ width: 60%; }}
        .bank-title {{ font-weight: bold; background-color: #e8f4f8 !important; text-align: center; font-size: 14px; }}
        .bank-separator td {{ height: 10px; background-color: #f9f9f9; border-left: none; border-right: none; }}
    </style>
    <div class="table-container">
        <table>
            <thead>
            <tr class="container-header"><th colspan="9">CONTAINER NUMBER: {container_number}</th></tr>
            <tr>
                    <th>LIST</th><th>NAME</th><th>ID CODE</th><th>ORDER</th><th>DESCRIPTION</th>
                    <th class="text-right">CBM</th><th class="text-right">UNIT</th><th class="text-right">TOTAL</th><th class="text-center">PACKAGES</th>
            </tr>
            </thead>
            <tbody>
    """

    num_orders = len(orders)

    for i, order in enumerate(orders):
        is_first_row = (i == 0)

        table_html += "        <tr>\n"

        if is_first_row:
            table_html += f"            <td class='v-align-middle' rowspan='{num_orders}'>{order.get('LIST_CODE', '')}</td>\n"
            table_html += f"            <td class='v-align-middle' rowspan='{num_orders}'>{order.get('NAME', '')}</td>\n"
            table_html += f"            <td class='v-align-middle' rowspan='{num_orders}'>{order.get('ID_CODE', '')}</td>\n"

        table_html += f"            <td>{order.get('ORDER_NUMBER', '')}</td>\n"
        table_html += f"            <td>{order.get('CARGO_DESCRIPTION', '')}</td>\n"
        table_html += f"            <td class='text-right'>{order.get('CBM', 0):.2f}</td>\n"
        table_html += f"            <td class='text-right'>{order.get('UNIT_CBM', 0):.2f}</td>\n"
        table_html += f"            <td class='text-right highlight'>{order.get('TOTAL_AMOUNT', 0):,.2f} Mt</td>\n"
        table_html += f"            <td class='text-center'>{order.get('PACKAGES', 0)}</td>\n"
        table_html += "        </tr>\n"

    table_html += f"""
            <tr class="total-row">
            <td colspan="4">TOTAL</td><td>-</td>
            <td class="text-right">{total_cbm:.2f}</td><td>-</td>
            <td class="text-right highlight">{total_amount:,.2f} Mt</td>
            <td class="text-center">{total_packages}</td>
            </tr>
            </tbody>
        </table>
    </div>
    {bank_html}
    """
    return table_html

def get_message_template(origin, name, list_code, id_code, phone, orders_str, container_number, loading_date, expected_date, payment_deadline, cbm, packages, cargo_desc, total_amount, bank_info):
    origin_text = "VINDO DA CHINA" if origin == "CHINA" else "IMPORTADA DE DUBAI"
    
    if total_amount == 0:
        return f"""BOA TARDE SR(a). *{name}*, 
*SEGUE ABAIXO A INFORMAÇÃO REFERENTE A SUA CARGA {origin_text}.*
    
    *LIST CODE* - {list_code}
    *ID CODE* - {id_code}
    *COSIGNEE* - {name}
    *CONTACTO* - {phone}
    *ORDER NUMBER* - {orders_str}
    *CONTAINER NUMBER* - {container_number}
    *LOADING DATE* - {loading_date}
    *PREVISÃO DE CHEGADA* - {expected_date} 
    *CBM* - {cbm:.2f}
    *PACKAGES* - {packages}
    *CARGA* - {cargo_desc}
      
    *ESTA MENSAGEM É SÓ PARA O SEU INFORME, POIS OS CUSTOS LOCAIS DA SUA MERCADORIA JÁ ESTÃO PAGOS*
    *AGUARDE PELA MENSAGEM DE ACTUALIZAÇÃO PARA LEVANTAMENTO DA CARGA*
      
*NOTAS*
      
    *1º - Todo o cliente que fez pagamento da mercadoria, por via de um Termo de Compromisso Bancário, pedimos que nos informe com antecedência. E todo o cliente que importar material hospitalar, deve apresentar  BIEF (Boletim de inspeção de especialidade Farmacêutica) e respetiva documentação.*    
    *2º - Esta carga tem 3 dias de armazenagem gratuita, e é aplicada a taxa de armazenagem de 1000.00MT por cada dia em que esta não for levantada, contados a partir da data da disponibilidade da carga incluindo feriados e fins de semana.* 
    *3º - O contentor é desempacotado em nosso armazém, localizado na CIDADE DA MATOLA, esquina entre Av. Francisco Manyanga/Rua da Escola e Av. Ngungunhane/Rua da Empasol Nº924.*
    *4º - Todos os custo de manuseio da carga que tenham dimensões fora do normal ou peso elevados, note que, a descarga directo para a viatura do cliente ou do Armazém para a viatura do cliente é suportado pelo cliente.*
    
     
OBRIGADO"""
    else:
        return f"""BOA TARDE SR(a). *{name}*, 
*SEGUE ABAIXO A INFORMAÇÃO REFERENTE A SUA CARGA {origin_text}.*
  
    *LIST CODE* - {list_code}
    *ID CODE* - {id_code}
    *COSIGNEE* - {name}
    *CONTACTO* - {phone}
    *ORDER NUMBER* - {orders_str}
    *CONTAINER NUMBER* - {container_number}
    *LOADING DATE* - {loading_date}
    *PREVISÃO DE CHEGADA* - {expected_date} 
    *CBM* - {cbm:.2f}
    *PACKAGES* - {packages}
    *CARGA* - {cargo_desc}
    *VALOR A PAGAR (Valor referente aos custos locais)* - {total_amount:,.2f} Mt
    *DATA LIMITE DE PAGAMENTO* - {payment_deadline}

    *AGUARDE PELA MENSAGEM DE ACTUALIZAÇÃO PARA LEVANTAMENTO DA CARGA*
  
*NOTAS*
      
    *1º  - Todo o cliente que fez pagamento da mercadoria, por via de um Termo de Compromisso Bancário, pedimos que nos informe com antecedência. E todo o cliente que importar material hospitalar, deve apresentar  BIEF (Boletim de inspeção de especialidade Farmacêutica) e respetiva documentação.*
    *2º  - A todos os pagamentos efetuados até a data limite em epígrafe, a Júpiter concede 3 dias de armazenagem gratuita ao cliente, contados a partir da data da disponibilidade da carga.*     
    *3º  - O não pagamento até a data de limite, retira-se ao cliente o benefício dos 3 dias de armazenagem gratuita e é aplicada a taxa de armazenagem de 1000.00MT por cada dia em que esta não for levantada incluindo feriados e fins de semana.* 
    *4º  - Os custos Locais devem ser pagos por transferência ou depósito para uma das contas a baixo.*
    *5º  - O Pagamento deste custo leva 24h para serem confirmados ou rejeitados após e recepcao do Comprovativo de Pagamento.*
    *6º  - Pagamentos efetuados através de Carteiras Moveis (Mpesa, Emola ou Mksesh) devem ser acompanhados do respectivo numero de telefone.*
    *7º  - Pedidos de reembolso levam de 2 semanas a 1 mes para serem confirmados.*
    *8º  - O contentor é desempacotado em nosso armazém na CIDADE DA MATOLA.*
    *9º  - Todos os custo de manuseio da carga que tenham dimensões fora do normal ou peso elevados, note que, a descarga directo para a viatura do cliente ou do Armazém para a viatura do cliente é suportado pelo cliente.*
    *10º - Pedimos o envio dos dados: NOME COMPLETO, ENDEREÇO, NUIT.*

{bank_info}
    
OBRIGADO"""
