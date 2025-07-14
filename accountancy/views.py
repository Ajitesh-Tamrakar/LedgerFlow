from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse, HttpResponseRedirect, Http404, HttpResponse
from rest_framework.decorators import api_view 
from .models import DailyMoneyInputs, Tasklist,Dealers, Payments, Bills
from django.utils.text import slugify
from django.urls import reverse
from datetime import date, timedelta
from django.db.models.functions import TruncWeek, TruncMonth
from django.db.models import Sum
from .filters import BillFilter
from collections import Counter
import itertools
import json
def homepage(request):    
    return render(request, 'accountancy/index.html')

def daily_collection(request):
    upi = request.POST.get('upi')
    cash = request.POST.get('cash')
    card = request.POST.get('card')
    total = float(upi)+float(cash)+float(card)
    
    DailyMoneyInputs(UPI=upi, cash=cash, cards=card, in_total = total).save()
    return redirect('/dashboard')

        
def dashboard(request):
    k = DailyMoneyInputs.objects.all()
    for day in k:
        date_collection = 0
        date_collection += day.UPI
        date_collection += day.cash
        date_collection += day.cards
        day.in_total = date_collection
    today = date.today()
    collections = DailyMoneyInputs.objects.filter(date= today).values('UPI', 'cash', 'cards')
    
    #getting today's collection  expecting multiple entry per day
    todays_collection = 0
    for collection in collections:
        todays_collection += collection['UPI']
        todays_collection += collection['cash']
        todays_collection += collection['cards']


    order_data = list(Tasklist.objects.all().values())
    #calculating today's profit assuming 20% of today's collection 
    today_profit = 0
    today_profit += int((todays_collection*20)/100)

    todays_bill = 0
    todays_bill += Bills.objects.filter(bill_date= today).count()

    #getting week worth of data

    today = date.today()
    week_day = today.weekday()  #weekday give output 0-6 monday being 0 and  6 being sunday
    start_date= today - timedelta(week_day) #timedelta is function calculate with time (basically fuction helping with say today is moday then what's the date 3 days before )
    end_date = start_date + timedelta(6)

    daily_data = DailyMoneyInputs.objects.filter(date__gte= start_date)
    # print(daily_data.values('UPI', 'cash', 'cards'))
    daily_data.values('UPI', 'cash', 'cards')
    daily_list = []
    for day in daily_data:
        date_collection = 0
        date_collection += day.UPI
        date_collection += day.cash
        date_collection += day.cards
        daily_list.append(date_collection)


    week_trunc = DailyMoneyInputs.objects.annotate(week_start=TruncWeek('date')).values('week_start').annotate(todays_collection=Sum('in_total')).order_by('week_start')
    week_data = []
    for i in week_trunc:
        week_data.append(i['todays_collection'])
    month_trunc = DailyMoneyInputs.objects.annotate(month_start=TruncMonth('date')).values('month_start').annotate(months_collection=Sum('in_total')).order_by('month_start')
    month_data = []

    for i in month_trunc:
        month_data.append(i['months_collection'])
    print(month_data)

    return render(request, 'accountancy/dashboard.html', {
        'order_data': order_data,
        'todays_collection': todays_collection,
        'today_profit': today_profit,
        'Bill_came_today': todays_bill,
        'daily_list': daily_list,
        'weekly_list': week_data,
        'month_list': month_data
    })

def record_page(request):
    name_id_list = Dealers.objects.values('id', 'party_name')
    bill_filter = BillFilter(request.GET, queryset=Bills.objects.all())
    payments = Payments.objects.values('dealer_id').annotate(total_payments = Sum('payment_amount'))
    bill_amounts = Bills.objects.values('dealer_id').annotate(total_bill_amount = Sum('bill_amount'))
    payment_dict = {}
    for payment in payments:
        payment_dict[payment['dealer_id']] = payment['total_payments']
        #got sum of all payment made to dealer in for dealer id : all payments
    bill_dict = {}
    for bill in bill_amounts:
        bill_dict[bill['dealer_id']] = bill['total_bill_amount']
        #got sum of all bill amounts got from perticular dealer in form of dealer id : total billed amount
    ledger_balace = dict(Counter(bill_dict)-Counter(payment_dict))
    print(sorted(ledger_balace.items()))
    total_outstanding = sum(ledger_balace.values())
    top_three_id_amount = dict(itertools.islice(ledger_balace.items(), 3))
    top_three = []
    for i in top_three_id_amount:
        container_dict = {}
        container_dict['dealer_name'] = Dealers.objects.get(id= i).party_name
        container_dict['gst_num'] = Dealers.objects.get(id= i).GST_num
        container_dict['amount'] =top_three_id_amount[i]
        top_three.append(container_dict)
    print(top_three)

    #     Dealers
    return render(request, 'accountancy/records.html',{
        'filter': bill_filter,
        'total_outstanding': total_outstanding,
        'top_three': top_three,
        'dealers': name_id_list
        })

def create_party_page(request):
    if request.method == 'POST':
        partyName = request.POST.get('party-name')
        party_slug = slugify(partyName)
        num_gst =  request.POST.get('GST_num')
        op_balance = request.POST.get("existing_balance")
        Dealers(party_name=partyName, party_slug=party_slug,opening_balance= op_balance, GST_num = num_gst).save()
    return HttpResponseRedirect('/records')


def bill_uploads(request):
    if request.method == 'POST':
        billImg = request.FILES['bill_image']
        billDate = request.POST.get('bill_date')
        partyId = request.POST.get('party_id')
        bill_amount = request.POST.get('bill_amount')
        dealer_obj = get_object_or_404(Dealers, id=partyId)
        Bills(bill_img=billImg, bill_date=billDate, dealer_id=dealer_obj, bill_amount= bill_amount).save()
    return HttpResponseRedirect('/records')



def payments(request):
    if request.method == 'POST':
        try:
            dealer_id = get_object_or_404(Dealers ,id= request.POST.get('dealer_id'))
            payment_date = request.POST.get('payment_date')
            payment_amount = request.POST.get('payment_amount')
            payment_method = request.POST.get('payment_method')
            Payments(dealer_id=dealer_id, payment_date=payment_date, payment_amount= payment_amount, payment_method=payment_method).save()
        except: 
            print('something was not right')
    return HttpResponseRedirect('/records')


def ledger_request(request):
        if request.method == 'POST':
            requested_dealer = request.POST.get('party_id')
            if requested_dealer:
                return redirect(reverse('ledger', kwargs={'requested_dealer': int(requested_dealer)}))
            else:
                return redirect(reverse('records'))
        else:
            return redirect(reverse('records'))

def ledger(request, requested_dealer):

    name_id_dict = Dealers.objects.values('party_name', 'id')
    ledger_balance = 0
    dealer_info = Dealers.objects.get(id=requested_dealer)
    bill_details = Bills.objects.filter(dealer_id= requested_dealer)
    payment_entries = Payments.objects.filter(dealer_id = requested_dealer)
    bill_count = bill_details.count()
    payment_count = payment_entries.count()
    ledger_lenght = bill_count+payment_count
    ledger_dict = {}
    for i in bill_details:
        ledger_dict[i.bill_date] = i

    for i in payment_entries:
        ledger_dict[i.payment_date] = i

    ledger_entries = []
    for i, j in dict(sorted(ledger_dict.items(), reverse=True)).items():
        print(i, j)
        if type(j).__name__ == 'Bills':
            ledger_dict = {}
            ledger_dict['type'] = 'Bill'
            ledger_dict['date'] = j.bill_date
            ledger_dict['amount'] = j.bill_amount
            ledger_balance += j.bill_amount
            ledger_dict['desc'] = ''
            ledger_entries.append(ledger_dict)
        if type(j).__name__ == 'Payments':
            ledger_dict = {}
            ledger_dict['type'] = 'Payment'
            ledger_dict['date'] = j.payment_date
            ledger_dict['amount'] = j.payment_amount
            ledger_balance -= j.payment_amount
            ledger_dict['desc'] = j.payment_method
            ledger_entries.append(ledger_dict)
        else:
            print('unexpected Model name',type(j).__name__)
    




    return render(request, 'accountancy/test.html', {
        'dealer_info': dealer_info,
        'bill_details': bill_details,
        'bill_count': bill_count,
        'payment_count': payment_count,
        'payment_entries': payment_entries.values(),
        'ledger_entries': ledger_entries,
        'ledger_balance': ledger_balance,
        'ledger_length': ledger_lenght,
        'dealers': name_id_dict
    })


def task_list(request):
    if request.method == 'GET':
        task_list = Tasklist.objects.values('id', 'task', 'task_status')
        last_task = Tasklist.objects.last()
        if last_task:
            return JsonResponse({'lastId': last_task.pk,'taskList':list(task_list)})
        else:
            print("No Tasklist objects found.")
        return JsonResponse({'last_id_not_found':list(task_list)})
    elif request.method == 'POST':
        json_data = json.loads(request.body)
        task = json_data.get('task')
        Tasklist(task=task).save()
        return JsonResponse({'status': 200})
    elif request.method == 'PATCH':
        json_data = json.loads(request.body)
        task_id = json_data.get('id')
        task_action = json_data.get('task_action')
        
        if task_action == 'update_status':
            print('it came here')
            try:
                task_obj = Tasklist.objects.get(id=task_id)
                task_obj.task_status = not task_obj.task_status  # Toggle directly
                task_obj.save()
                return JsonResponse({'status': 'success', 'new_status': task_obj.task_status})
            except Tasklist.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'Task not found'})
        elif task_action == 'update_task':
            try:
                task_obj = Tasklist.objects.get(id=task_id)
                task_obj.task = json_data.get('task')
                task_obj.save()
                return JsonResponse({'status': 'success', 'new_task': task_obj.task})
            except Tasklist.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'Task not found'})
            
    elif request.method == 'DELETE':
        json_data = json.loads(request.body)
        task_id = json_data.get('id')
        try:
            task_obj = Tasklist(id=task_id)
            task_obj.delete()
            return JsonResponse({'status': 'delete success'})
        except Tasklist.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Task not found'})

    
    return JsonResponse({'something went wrong':500})