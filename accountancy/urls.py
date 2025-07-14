from django.urls import path
from . import views

urlpatterns = [
    path('', views.homepage, name='homepage'),
    path('daily-collection/', views.daily_collection, name='collectionAPI'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('records/', views.record_page, name='records'), 
    path('create-party/', views.create_party_page, name='create-party'),
    path('bill-uploads/', views.bill_uploads, name="bill-images"),
    path('payments/', views.payments, name='payments'),
    path('ledger-request/', views.ledger_request, name="ledger_request"),
    path('ledger-view/<int:requested_dealer>/', views.ledger, name='ledger'),
    path('task-list', views.task_list, name='task')
    
    
 ]
